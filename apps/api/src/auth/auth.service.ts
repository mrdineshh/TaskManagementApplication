import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { AuthProvider } from './providers/auth-provider.interface';
import { AUTH_PROVIDER_REGISTRY } from './providers/auth-provider.interface';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  permissions: string[];
  departmentIds: string[];
  hasOrgWideRole: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER_REGISTRY) private readonly providers: Map<string, AuthProvider>,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
  ) {}

  /** Exchanges a raw identity token from `providerName` for an app JWT pair (03-RBAC-AUTH.md §1.1). */
  async exchange(providerName: string, rawToken: string) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new UnauthorizedException(`Unknown or disabled auth provider: ${providerName}`);
    }

    const identity = await provider.verifyToken(rawToken);

    const allowedDomain = this.config.get<string>('ALLOWED_EMAIL_DOMAIN');
    if (allowedDomain && !identity.email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`)) {
      throw new UnauthorizedException(
        `Sign-in restricted to @${allowedDomain} accounts`,
      );
    }

    // Invite-only (docs/10-OPEN-DECISIONS.md §G4): an Admin must create the User row — via
    // work_country/work_state, primary department, roles, manager — before anyone can sign in
    // at all, SSO included. No self-service auto-provisioning on first login; a real identity
    // token from Google/Firebase is not by itself authorization to create an account.
    const user = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (!user) {
      throw new UnauthorizedException(
        'No account found for this email — ask an Admin to create your account first',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        // Backfills the provider external ID on a pre-invited user's first real sign-in.
        authProviderId: user.authProviderId ?? identity.externalId,
      },
    });

    return this.issueTokenPair(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account no longer available');
    }
    return this.issueTokenPair(user.id, user.email);
  }

  private async issueTokenPair(userId: string, email: string) {
    const effective = await this.rbac.getEffectivePermissions(userId);

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      email,
      permissions: effective.permissionKeys,
      departmentIds: effective.departmentIds,
      hasOrgWideRole: effective.hasOrgWideRole,
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '30m',
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
      },
    );

    return { accessToken, refreshToken };
  }
}
