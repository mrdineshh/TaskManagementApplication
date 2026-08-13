import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';

/**
 * Google Sign-In is the v1 auth method (docs/03-RBAC-AUTH.md §1.1), but until real
 * Firebase/GCP OAuth credentials are provided, this page uses the dev auth provider
 * (see apps/api/src/auth/providers/dev-auth.provider.ts) — enter any seeded @econz.net
 * email to exercise the exact same login → JWT → session flow the Google button will use.
 */
export function LoginPage() {
  const [email, setEmail] = useState('admin@econz.net');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens, setCurrentUser } = useSessionStore();
  const navigate = useNavigate();

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { access_token, refresh_token } = await apiClient.auth.dev(email);
      setTokens(access_token, refresh_token);
      const me = await apiClient.me.get();
      setCurrentUser(me as never);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-500/10"
      />
      <div className="relative w-full max-w-sm animate-pop-in rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg shadow-slate-200/50 dark:shadow-none">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white">
          T
        </div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Task Management</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Sign in with your @econz.net account</p>

        <button
          type="button"
          disabled
          title="Enabled once Firebase/Google OAuth credentials are configured"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 opacity-60"
        >
          Sign in with Google (pending GCP setup)
        </button>

        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          dev sign-in (mock)
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <form onSubmit={handleDevLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@econz.net"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-brand-500 dark:focus:border-brand-400 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in (dev)'}
          </button>
        </form>
      </div>
    </div>
  );
}
