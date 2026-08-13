import type { CurrentUser } from '@taskapp/shared-types';

/** Mirrors apps/api/src/rbac/rbac.service.ts's ROLE_PRIORITY — highest-privilege first. */
const ROLE_PRIORITY = ['Admin', 'Management', 'Head', 'Manager', 'Employee'];

/**
 * Client-side mirror of RbacService.resolveActiveRoleName (docs/10-OPEN-DECISIONS.md §G3/§K)
 * — which role the UI should currently be framed around. Used to decide nav visibility; the
 * backend independently re-derives the same thing for scope decisions, so the two can never
 * drift into showing a nav item for a view the API would then refuse to serve.
 */
export function resolveActiveRoleName(user: CurrentUser | null): string | null {
  if (!user) return null;
  const active = user.roles.find((r) => r.id === user.active_role_id);
  if (active) return active.name;
  const held = new Set(user.roles.map((r) => r.name));
  return ROLE_PRIORITY.find((name) => held.has(name)) ?? null;
}
