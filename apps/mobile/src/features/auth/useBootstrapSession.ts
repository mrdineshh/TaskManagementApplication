import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { useSessionStore } from '../../lib/auth/session-store';
import { apiClient } from '../../lib/api-client/client';

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:3000';

/** Mirrors apps/web's useBootstrapSession.ts — restores a session from the securely-stored refresh token. */
export function useBootstrapSession() {
  const { hydrate, setTokens, setCurrentUser, clear } = useSessionStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await hydrate();
      const refreshToken = useSessionStore.getState().refreshToken;
      if (!refreshToken) {
        setReady(true);
        return;
      }
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) throw new Error('refresh failed');
        const body = await res.json();
        if (cancelled) return;
        setTokens(body.access_token, body.refresh_token);

        const me = await apiClient.me.get();
        if (!cancelled) setCurrentUser(me as never);
      } catch {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
