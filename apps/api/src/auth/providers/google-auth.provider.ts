import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProvider, VerifiedIdentity } from './auth-provider.interface';

/**
 * Firebase-Auth-backed Google Sign-In (docs/03-RBAC-AUTH.md §1.1). Verifies the
 * Firebase ID token the client obtained after Google sign-in.
 *
 * Requires FIREBASE_PROJECT_ID + Firebase Admin credentials (GCP Application
 * Default Credentials in deployed environments). Until real GCP/Firebase
 * project access is provided, this provider is registered but not selected
 * (AUTH_PROVIDERS env var controls which provider(s) are active) — use
 * DevAuthProvider for local development in the meantime.
 */
@Injectable()
export class GoogleAuthProvider implements AuthProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleAuthProvider.name);
  private firebaseApp: unknown;

  constructor(private readonly config: ConfigService) {}

  async verifyToken(rawToken: string): Promise<VerifiedIdentity> {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new UnauthorizedException(
        'Google auth provider is not configured (FIREBASE_PROJECT_ID missing)',
      );
    }

    // Lazy-loaded so `firebase-admin` isn't a hard dependency for local/dev-only runs.
    const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    if (!this.firebaseApp) {
      this.firebaseApp = getApps().length
        ? getApps()[0]
        : initializeApp({ credential: applicationDefault(), projectId });
    }

    try {
      const decoded = await getAuth().verifyIdToken(rawToken);
      const email = decoded.email;
      if (!email) {
        throw new UnauthorizedException('Google identity token has no email claim');
      }
      return { email, externalId: decoded.uid, name: decoded.name ?? email };
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Google identity token');
    }
  }
}
