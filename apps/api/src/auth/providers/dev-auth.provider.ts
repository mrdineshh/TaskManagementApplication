import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProvider, VerifiedIdentity } from './auth-provider.interface';

/**
 * Mock identity provider for local development and demos, used while real
 * Google/Firebase credentials aren't available yet (per the user's request to
 * build against mocked flows first). NEVER enabled outside dev — controlled
 * solely by the AUTH_PROVIDERS env var, which must not include "dev" in
 * staging/prod deployments.
 *
 * "Token" here is just the plain email address of a seeded user — it stands
 * in for a verified Google identity token so the rest of the auth flow
 * (domain check, user lookup/creation, JWT issuance) is exercised exactly as
 * it will be with the real provider.
 */
@Injectable()
export class DevAuthProvider implements AuthProvider {
  readonly name = 'dev';

  constructor(private readonly config: ConfigService) {}

  async verifyToken(rawToken: string): Promise<VerifiedIdentity> {
    const email = rawToken.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new UnauthorizedException('Dev auth provider expects a plain email as the token');
    }
    return { email, externalId: `dev:${email}`, name: email.split('@')[0] };
  }
}
