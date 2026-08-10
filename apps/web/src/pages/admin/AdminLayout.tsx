import { NavLink, Outlet } from 'react-router-dom';

const sections = [
  { to: '', label: 'Overview', end: true },
  { to: 'departments', label: 'Departments' },
  { to: 'roles', label: 'Roles & Permissions' },
  { to: 'users', label: 'Users' },
  { to: 'custom-fields', label: 'Custom Fields' },
  { to: 'workflows', label: 'Workflows' },
  { to: 'priorities', label: 'Priorities' },
  { to: 'sla', label: 'SLA Policies' },
  { to: 'integrations', label: 'Integrations' },
  { to: 'settings', label: 'Org Settings' },
];

/** Admin area shell — visible only to users with a *.manage permission (docs/06-FRONTEND-WEB.md §6). */
export function AdminLayout() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Admin</h1>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0 space-y-1">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-1.5 text-sm ${
                  isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
