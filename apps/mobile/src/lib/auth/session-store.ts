import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { CurrentUser } from '@taskapp/shared-types';

const REFRESH_TOKEN_KEY = 'taskapp.refreshToken';

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: CurrentUser | null;
  hydrated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentUser: (user: CurrentUser) => void;
  hydrate: () => Promise<void>;
  clear: () => void;
}

/**
 * Session state — mirrors apps/web's session-store.ts, but the refresh token lives in
 * expo-secure-store (iOS Keychain / Android Keystore) per docs/07-FRONTEND-MOBILE.md §1,
 * never AsyncStorage. The access token stays in memory only.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  currentUser: null,
  hydrated: false,

  setTokens: (accessToken, refreshToken) => {
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setCurrentUser: (currentUser) => set({ currentUser }),

  hydrate: async () => {
    if (get().hydrated) return;
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    set({ refreshToken, hydrated: true });
  },

  clear: () => {
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, currentUser: null });
  },
}));
