import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSessionStore } from '../lib/auth/session-store';
import { useHasAnyPermission, usePermission } from '../lib/permissions/usePermission';
import { apiClient } from '../lib/api-client/client';

const navItems = [
  { to: '/', label: 'My Tasks', end: true },
  { to: '/tasks', label: 'All Tasks' },
  { to: '/tasks/board', label: 'Kanban' },
  { to: '/tasks/timeline', label: 'Timeline' },
  { to: '/team', label: 'Team' },
  { to: '/notifications', label: 'Notifications' },
];

export function Shell() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const clear = useSessionStore((s) => s.clear);
  const isAdmin = useHasAnyPermission('.manage');
  const canViewReports = usePermission('report.view');

  async function handleLogout() {
    await apiClient.auth.logout().catch(() => {});
    clear();
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <span className="text-sm font-semibold text-slate-900">Task Management</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {canViewReports && (
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Reports
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate text-xs font-medium text-slate-700">{currentUser?.full_name}</p>
          <p className="truncate text-xs text-slate-400">{currentUser?.email}</p>
          <div className="mt-2 flex gap-3">
            <Link to="/settings" className="text-xs text-slate-400 hover:text-slate-700">
              Settings
            </Link>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-700">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
