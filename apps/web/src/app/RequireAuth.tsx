import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../lib/auth/session-store';

export function RequireAuth() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const bootstrapped = useSessionStore((s) => s.bootstrapped);
  // Wait for the async token exchange / /me fetch before deciding to redirect.
  if (!bootstrapped) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Outlet />;
}
