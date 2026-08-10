import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, type AccessTokenPayload } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExchangeTokenDto, RefreshTokenDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { updateOwnProfileSchema } from '@taskapp/shared-types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('google')
  google(@Body() dto: ExchangeTokenDto) {
    return this.auth.exchange('google', dto.token);
  }

  /** Dev-only mock sign-in — see providers/dev-auth.provider.ts. Disabled unless AUTH_PROVIDERS includes "dev". */
  @Public()
  @Post('dev')
  dev(@Body() dto: ExchangeTokenDto) {
    return this.auth.exchange('dev', dto.token);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Public()
  @Post('logout')
  logout() {
    // Stateless JWTs in v1 — nothing server-side to revoke; the client discards its tokens.
    // A refresh-token denylist is a reasonable v1.1 hardening addition if needed.
    return { success: true };
  }
}

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AccessTokenPayload) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: record.id,
      email: record.email,
      full_name: record.fullName,
      avatar_url: record.avatarUrl,
      primary_department_id: record.primaryDepartmentId,
      auth_provider: record.authProvider,
      is_active: record.isActive,
      last_login_at: record.lastLoginAt,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      roles: record.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
      permissions: user.permissions,
    };
  }

  @Patch()
  async updateMe(@CurrentUser() user: AccessTokenPayload, @Body() body: unknown) {
    const input = updateOwnProfileSchema.parse(body);
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { fullName: input.full_name, avatarUrl: input.avatar_url },
    });
    return { id: updated.id, full_name: updated.fullName, avatar_url: updated.avatarUrl };
  }
}
