import { create } from 'zustand';
import type { CurrentUser } from '@taskapp/shared-types';

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: CurrentUser | null;
  /** True once the async bootstrap (token exchange + /me fetch) has completed. */
  bootstrapped: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentUser: (user: CurrentUser) => void;
  setBootstrapped: () => void;
  clear: () => void;
}

const REFRESH_TOKEN_KEY = 'taskapp.refreshToken';

// Clean up any legacy persisted logins in localStorage
try {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
} catch {
  // Ignore in restricted environments
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REFRESH_TOKEN_KEY) : null,
  currentUser: null,
  bootstrapped: false,
  setTokens: (accessToken, refreshToken) => {
    try {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {}
    set({ accessToken, refreshToken });
  },
  setCurrentUser: (currentUser) => set({ currentUser }),
  setBootstrapped: () => set({ bootstrapped: true }),
  clear: () => {
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {}
    set({ accessToken: null, refreshToken: null, currentUser: null, bootstrapped: true });
  },
}));
