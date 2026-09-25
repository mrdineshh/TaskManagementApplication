import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Columns3,
  BarChart3,
  Users2,
  ShieldCheck,
  Bug,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Trophy,
  CalendarDays,
  Clock,
  Settings2,
} from 'lucide-react';
import { useSessionStore } from '../lib/auth/session-store';
import { useHasAnyPermission, usePermission } from '../lib/permissions/usePermission';
import { resolveActiveRoleName } from '../lib/auth/roles';
import { RoleSwitcher } from './RoleSwitcher';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { ToastContainer } from '../components/ToastContainer';
import { NotificationBell, NotificationToasts } from '../components/NotificationBell';
import { GlobalSearch } from '../components/GlobalSearch';
import { BugReportModal } from '../components/BugReportModal';
import { BackButton } from '../components/BackButton';

/** Roles whose active view includes a Team page */
const TEAM_ROLES = new Set(['Manager', 'Head', 'Management', 'Admin']);

const SIDEBAR_COLLAPSED_KEY = 'taskapp.sidebarCollapsed';

const NAV_ITEMS = [
  { to: '/',                              label: 'My Tasks',  icon: LayoutDashboard, end: true },
  { to: '/tasks',                         label: 'All Tasks', icon: ListTodo },
  { to: '/tasks/board',                   label: 'Kanban',    icon: Columns3 },
  { to: '/tasks/timeline',               label: 'Timeline',  icon: CalendarDays },
  { to: '/tasks/timesheet/employees',    label: 'Timesheet', icon: Clock },
  { to: '/scorecard',                     label: 'Scorecard', icon: Trophy },
];

const isTaskDetail = (path: string) =>
  path.startsWith('/tasks/') &&
  !path.startsWith('/tasks/board') &&
  !path.startsWith('/tasks/timeline') &&
  !path.startsWith('/tasks/timesheet');

function isItemActive(itemTo: string, currentPath: string): boolean {
  if (itemTo === '/') return currentPath === '/';
  if (itemTo === '/tasks') {
    return currentPath === '/tasks' || isTaskDetail(currentPath);
  }
  if (itemTo === '/tasks/timesheet/employees') {
    return currentPath.startsWith('/tasks/timesheet');
  }
  return currentPath === itemTo || currentPath.startsWith(itemTo + '/');
}

export function Shell() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const clear = useSessionStore((s) => s.clear);
  const isAdmin = useHasAnyPermission('.manage');
  const canViewReports = usePermission('report.view');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const location = useLocation();

  const activeRoleName = resolveActiveRoleName(currentUser);
  const showTeam = !!activeRoleName && TEAM_ROLES.has(activeRoleName);
  const showAdmin = isAdmin && activeRoleName === 'Admin';

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }

  async function handleLogout() {
    await import('../lib/api-client/client').then(m => m.apiClient.auth.logout()).catch(() => {});
    clear();
    window.location.href = '/login';
  }

  const initials = currentUser?.full_name
    ? currentUser.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--neu-bg)' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col shrink-0 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
        style={{
          background: 'var(--neu-bg)',
          boxShadow: '4px 0 16px var(--neu-dark)',
          zIndex: 40,
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="flex items-center justify-between px-3 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--neu-dark)' }}
        >
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: '#2563EB', boxShadow: '0 3px 8px rgba(37,99,235,0.4)' }}
              >
                P
              </div>
              <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                Pulse
              </span>
            </Link>
          )}
          {collapsed && (
            <Link
              to="/"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold mx-auto"
              style={{ background: '#2563EB', boxShadow: '0 3px 8px rgba(37,99,235,0.4)' }}
            >
              P
            </Link>
          )}
          {!collapsed && (
            <button onClick={toggleCollapsed} className="nav-icon-btn !w-7 !h-7 !rounded-md shrink-0" title="Collapse">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role switcher */}
        <div className={collapsed ? 'px-1 py-2' : 'px-2 py-2'}>
          <RoleSwitcher collapsed={collapsed} />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = isItemActive(item.to, location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
              >
                <item.icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: isActive ? 'var(--brand)' : 'var(--text-faint)' }}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          {showTeam && (
            <Link
              to="/team"
              title={collapsed ? 'Team' : undefined}
              className={`nav-item ${location.pathname.startsWith('/team') ? 'active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
            >
              <Users2
                className="w-4 h-4 shrink-0"
                style={{ color: location.pathname.startsWith('/team') ? 'var(--brand)' : 'var(--text-faint)' }}
              />
              {!collapsed && <span className="truncate">Team</span>}
            </Link>
          )}

          {canViewReports && (
            <Link
              to="/reports"
              title={collapsed ? 'Reports' : undefined}
              className={`nav-item ${location.pathname.startsWith('/reports') ? 'active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
            >
              <BarChart3
                className="w-4 h-4 shrink-0"
                style={{ color: location.pathname.startsWith('/reports') ? 'var(--brand)' : 'var(--text-faint)' }}
              />
              {!collapsed && <span className="truncate">Reports</span>}
            </Link>
          )}

          {showAdmin && (
            <Link
              to="/admin"
              title={collapsed ? 'Admin' : undefined}
              className={`nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
            >
              <ShieldCheck
                className="w-4 h-4 shrink-0"
                style={{ color: location.pathname.startsWith('/admin') ? 'var(--brand)' : 'var(--text-faint)' }}
              />
              {!collapsed && <span className="truncate">Admin</span>}
            </Link>
          )}
        </nav>

        {/* Sidebar bottom — only Report Bug */}
        <div
          className="shrink-0 px-2 py-3 space-y-1"
          style={{ borderTop: '1px solid var(--neu-dark)' }}
        >
          <button
            onClick={() => setBugReportOpen(true)}
            title={collapsed ? 'Report Bug' : undefined}
            className={`nav-item w-full text-left ${collapsed ? 'justify-center !px-0' : ''}`}
          >
            <Bug className="w-4 h-4 shrink-0" style={{ color: 'var(--text-faint)' }} />
            {!collapsed && <span className="truncate">Report Bug</span>}
          </button>

          {/* Expand button (only in collapsed state) */}
          {collapsed && (
            <button
              onClick={toggleCollapsed}
              className="nav-item w-full justify-center !px-0"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header
          className="shrink-0 flex items-center gap-3 px-5 py-3"
          style={{
            background: 'var(--neu-bg)',
            boxShadow: '0 2px 8px var(--neu-dark)',
            zIndex: 30,
          }}
        >
          {/* Back button */}
          <BackButton />

          {/* Breadcrumbs */}
          <div className="flex-1 min-w-0">
            <Breadcrumbs />
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 shrink-0">
            <GlobalSearch />
            <ThemeToggle collapsed={false} />
            <NotificationBell />

            {/* Avatar → opens profile/settings menu */}
            <div className="relative">
              <button
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  boxShadow: '0 3px 10px rgba(37,99,235,0.4)',
                }}
                title={currentUser?.full_name ?? 'Profile'}
                aria-label="Open profile menu"
              >
                {initials}
              </button>

              {avatarMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAvatarMenuOpen(false)}
                  />
                  {/* Menu */}
                  <div
                    className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl overflow-hidden animate-pop-in"
                    style={{
                      background: 'var(--neu-bg)',
                      boxShadow: '8px 8px 24px var(--neu-dark), -4px -4px 12px var(--neu-light)',
                    }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--neu-dark)' }}>
                      <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {currentUser?.full_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {currentUser?.email}
                      </p>
                    </div>
                    {/* Menu items */}
                    <div className="p-1.5 space-y-0.5">
                      <Link
                        to="/settings"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[rgba(37,99,235,0.07)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Settings2 className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
                        Settings
                      </Link>
                      <button
                        onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-colors hover:bg-[rgba(239,68,68,0.07)]"
                        style={{ color: '#ef4444' }}
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5" style={{ background: 'var(--neu-bg)' }}>
          <div key={location.pathname} className="animate-fade-in max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global overlays */}
      <ToastContainer />
      <NotificationToasts />
      {bugReportOpen && <BugReportModal onClose={() => setBugReportOpen(false)} />}
    </div>
  );
}
