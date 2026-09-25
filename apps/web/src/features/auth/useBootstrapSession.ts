import { useEffect } from 'react';
import { useSessionStore } from '../../lib/auth/session-store';
import { apiClient } from '../../lib/api-client/client';
import { registerPushNotifications } from '../../lib/push/registerPush';
import { requestDesktopNotificationPermission } from '../../lib/notifications/desktop-notifications';

/**
 * On app load, if a refresh token is stored, silently exchange it for a fresh access
 * token and load /me — restores the session across page reloads without a full re-login.
 * Sets `bootstrapped = true` in the session store when complete (success or failure),
 * so RequireAuth can safely gate protected routes without a premature /login redirect.
 */
export function useBootstrapSession() {
  const { refreshToken, accessToken, setTokens, setCurrentUser, setBootstrapped, clear } = useSessionStore();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!refreshToken) {
        setBootstrapped();
        return;
      }
      try {
        if (!accessToken) {
          const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
          const res = await fetch(`${apiBase}/api/v1/auth/refresh`, {
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
        if (!cancelled) {
          setCurrentUser(me as never);
          // Non-blocking — push setup and desktop notification permission must never delay the app or throw.
          void registerPushNotifications((me as any).id);
          void requestDesktopNotificationPermission().catch(() => {});
        }

      } catch {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setBootstrapped();
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
