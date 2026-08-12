import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../lib/auth/session-store';

export function RequireAuth() {
  const currentUser = useSessionStore((s) => s.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Outlet />;
}
