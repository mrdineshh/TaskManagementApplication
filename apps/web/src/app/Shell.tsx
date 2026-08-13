import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSessionStore } from '../lib/auth/session-store';
import { useHasAnyPermission, usePermission } from '../lib/permissions/usePermission';
import { apiClient } from '../lib/api-client/client';
import { resolveActiveRoleName } from '../lib/auth/roles';
import { RoleSwitcher } from './RoleSwitcher';
import { Breadcrumbs } from './Breadcrumbs';

const baseNavItems = [
  { to: '/', label: 'My Tasks', end: true },
  { to: '/tasks', label: 'All Tasks' },
  { to: '/tasks/board', label: 'Kanban' },
  { to: '/tasks/timeline', label: 'Timeline' },
  { to: '/scorecard', label: 'Scorecard' },
  { to: '/notifications', label: 'Notifications' },
];

/** Roles whose active view includes a "Team" page (docs/10-OPEN-DECISIONS.md §K) — an
 * Employee has no reports/department to manage, so the nav hides it entirely rather than
 * showing an empty page. */
const TEAM_ROLES = new Set(['Manager', 'Head', 'Management', 'Admin']);

const SIDEBAR_COLLAPSED_KEY = 'taskapp.sidebarCollapsed';

export function Shell() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const clear = useSessionStore((s) => s.clear);
  const isAdmin = useHasAnyPermission('.manage');
  const canViewReports = usePermission('report.view');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');

  const activeRoleName = resolveActiveRoleName(currentUser);
  const showTeam = !!activeRoleName && TEAM_ROLES.has(activeRoleName);
  // Admin's nav item follows the active role, not just the raw permission — toggling to
  // "Employee" hides it so an Admin previewing another role's experience sees what that role
  // actually sees, per the user's "the toggle will reframe the entire app" confirmation.
  const showAdmin = isAdmin && activeRoleName === 'Admin';

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }

  async function handleLogout() {
    await apiClient.auth.logout().catch(() => {});
    clear();
    window.location.href = '/login';
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block truncate rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-screen">
      <aside className={`flex flex-col border-r border-slate-200 bg-white transition-all ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-4">
          {!collapsed && <span className="truncate text-sm font-semibold text-slate-900">Task Management</span>}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <RoleSwitcher collapsed={collapsed} />

        <nav className="flex-1 space-y-1 p-2">
          {baseNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} title={collapsed ? item.label : undefined}>
              {collapsed ? item.label[0] : item.label}
            </NavLink>
          ))}
          {showTeam && (
            <NavLink to="/team" className={navLinkClass} title={collapsed ? 'Team' : undefined}>
              {collapsed ? 'T' : 'Team'}
            </NavLink>
          )}
          {canViewReports && (
            <NavLink to="/reports" className={navLinkClass} title={collapsed ? 'Reports' : undefined}>
              {collapsed ? 'R' : 'Reports'}
            </NavLink>
          )}
          {showAdmin && (
            <NavLink to="/admin" className={navLinkClass} title={collapsed ? 'Admin' : undefined}>
              {collapsed ? 'A' : 'Admin'}
            </NavLink>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          {!collapsed && (
            <>
              <p className="truncate text-xs font-medium text-slate-700">{currentUser?.full_name}</p>
              <p className="truncate text-xs text-slate-400">{currentUser?.email}</p>
            </>
          )}
          <div className={`mt-2 flex gap-3 ${collapsed ? 'flex-col' : ''}`}>
            <Link to="/settings" className="text-xs text-slate-400 hover:text-slate-700">
              {collapsed ? '⚙' : 'Settings'}
            </Link>
            <button onClick={handleLogout} className="text-left text-xs text-slate-400 hover:text-slate-700">
              {collapsed ? '⏻' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <Breadcrumbs />
        <Outlet />
      </main>
    </div>
  );
}
