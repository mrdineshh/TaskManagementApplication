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
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Task Management</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in with your @econz.net account</p>

        <button
          type="button"
          disabled
          title="Enabled once Firebase/Google OAuth credentials are configured"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400 opacity-60"
        >
          Sign in with Google (pending GCP setup)
        </button>

        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          dev sign-in (mock)
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleDevLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@econz.net"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
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
