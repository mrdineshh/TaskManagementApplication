import Constants from 'expo-constants';
import { createApiClient } from '@taskapp/api-client';
import { useSessionStore } from '../auth/session-store';

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:3000';

export const apiClient = createApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => useSessionStore.getState().accessToken,
  getRefreshToken: () => useSessionStore.getState().refreshToken,
  onTokensRefreshed: (accessToken, refreshToken) => useSessionStore.getState().setTokens(accessToken, refreshToken),
  onAuthFailure: () => useSessionStore.getState().clear(),
});
