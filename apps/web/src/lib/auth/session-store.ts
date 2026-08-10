import { create } from 'zustand';
import type { CurrentUser } from '@taskapp/shared-types';

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: CurrentUser | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentUser: (user: CurrentUser) => void;
  clear: () => void;
}

const REFRESH_TOKEN_KEY = 'taskapp.refreshToken';

/**
 * Global session state (Zustand) — one of the few cross-cutting concerns per
 * docs/06-FRONTEND-WEB.md §4. The access token stays in memory only; the refresh
 * token persists to localStorage for now so a page reload doesn't force a re-login.
 *
 * docs/03-RBAC-AUTH.md §1.3 calls for httpOnly-cookie refresh-token storage on web —
 * that requires the backend to issue the cookie itself (Set-Cookie on /auth/*), which
 * isn't wired up yet since AuthController currently returns tokens in the JSON body
 * for parity with the mobile client. Swap this for cookie-based storage once that's
 * in place; nothing else in the app depends on where the refresh token physically lives.
 */
export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  currentUser: null,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },
  setCurrentUser: (currentUser) => set({ currentUser }),
  clear: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, currentUser: null });
  },
}));
