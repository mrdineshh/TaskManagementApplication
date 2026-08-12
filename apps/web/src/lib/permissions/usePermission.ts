import { useSessionStore } from '../auth/session-store';

/**
 * Cosmetic-only permission check (docs/06-FRONTEND-WEB.md §5): hides UI a user can't
 * use so they aren't met with a 403 after clicking. Carries NO security weight — the
 * backend Guard on every endpoint is the only real enforcement point. Never use this
 * to "protect" anything; it only shapes what's shown.
 */
export function usePermission(permissionKey: string): boolean {
  return useSessionStore((s) => s.currentUser?.permissions.includes(permissionKey) ?? false);
}

export function useHasAnyPermission(substring: string): boolean {
  return useSessionStore((s) => s.currentUser?.permissions.some((p) => p.includes(substring)) ?? false);
}
