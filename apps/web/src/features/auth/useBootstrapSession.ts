import { useEffect, useState } from 'react';
import { useSessionStore } from '../../lib/auth/session-store';
import { apiClient } from '../../lib/api-client/client';

/**
 * On app load, if a refresh token is stored, silently exchange it for a fresh access
 * token and load /me — restores the session across page reloads without a full re-login.
 */
export function useBootstrapSession() {
  const { refreshToken, accessToken, setTokens, setCurrentUser, clear } = useSessionStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!refreshToken) {
        setReady(true);
        return;
      }
      try {
        if (!accessToken) {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (!res.ok) throw new Error('refresh failed');
          const body = await res.json();
          if (cancelled) return;
          setTokens(body.access_token, body.refresh_token);
        }
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
