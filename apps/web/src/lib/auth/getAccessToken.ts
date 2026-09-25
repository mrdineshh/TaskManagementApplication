/**
 * Returns the current in-memory access token from the Zustand session store.
 * Use this for raw fetch() calls that can't go through the api-client (e.g. file uploads,
 * service worker registration). The access token is kept in memory only — NOT in localStorage.
 *
 * Uses Zustand's imperative .getState() API so this function is safe to call outside
 * React components (no hooks, no re-renders).
 */
import { useSessionStore } from './session-store';

export function getAccessToken(): string {
  return useSessionStore.getState().accessToken ?? '';
}
