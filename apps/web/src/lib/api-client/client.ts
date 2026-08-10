import { createApiClient } from '@taskapp/api-client';
import { useSessionStore } from '../auth/session-store';

/**
 * Web-specific wrapper around the shared api-client (docs/06-FRONTEND-WEB.md §2) —
 * injects auth headers from the Zustand session store and wires up refresh/logout.
 */
// Empty string in dev — Vite's proxy (vite.config.ts) forwards /api to the local NestJS
// server. In production this is set to the deployed Cloud Run API URL at build time.
export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  getAccessToken: () => useSessionStore.getState().accessToken,
  getRefreshToken: () => useSessionStore.getState().refreshToken,
  onTokensRefreshed: (accessToken, refreshToken) => useSessionStore.getState().setTokens(accessToken, refreshToken),
  onAuthFailure: () => {
    useSessionStore.getState().clear();
    window.location.href = '/login';
  },
});
