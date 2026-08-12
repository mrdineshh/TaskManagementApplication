/**
 * Pluggable identity-source abstraction per docs/03-RBAC-AUTH.md §1.2.
 * Google (Firebase) is the only implementation at launch; a future internal
 * OIDC/SAML SSO implements this same interface without touching auth logic
 * elsewhere in the app. Never hardcode Google as the sole identity source.
 */
export interface VerifiedIdentity {
  email: string;
  externalId: string;
  name: string;
}

export interface AuthProvider {
  readonly name: string;
  verifyToken(rawToken: string): Promise<VerifiedIdentity>;
}

export const AUTH_PROVIDER_REGISTRY = 'AUTH_PROVIDER_REGISTRY';
