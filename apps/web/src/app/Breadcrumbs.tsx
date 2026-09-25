import { Link, useLocation } from 'react-router-dom';
import { useTask, useEmployeeTimesheetDetail, useUsers } from '../features/tasks/hooks';
import { useReport } from '../features/reports/hooks';

const STATIC_LABELS: Record<string, string> = {
  // Task views
  tasks: 'Tasks',
  board: 'Kanban',
  'my-tasks': 'My Tasks',
  kanban: 'Kanban',
  timeline: 'Timeline',
  // Timesheet
  timesheet: 'Timesheets',
  timesheets: 'Timesheets',
  employees: 'Employees',
  employee: 'Employee',
  // Team & people
  team: 'Team',
  scorecard: 'Scorecard',
  leaderboard: 'Leaderboard',
  // Reports
  reports: 'Reports',
  builder: 'Report Builder',
  // Common
  edit: 'Edit',
  settings: 'Settings',
  notifications: 'Notifications',
  'bug-reports': 'Bug Reports',
  // Admin sections
  admin: 'Admin',
  departments: 'Departments',
  roles: 'Roles & Permissions',
  users: 'Users',
  'custom-fields': 'Custom Fields',
  workflows: 'Workflows',
  priorities: 'Priorities',
  sla: 'SLA Policies',
  'holiday-calendars': 'Holiday Calendars',
  'on-hold-reasons': 'On-Hold Reasons',
  'scorecard-weights': 'Scorecard Weights',
  integrations: 'Integrations',
  'org-settings': 'Org Settings',
  'user-settings': 'Profile Settings',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Full-path breadcrumbs with dynamic label resolution for tasks, employees, reports, etc.
 * Raw database UUIDs are never exposed in the navigation UI.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  // 1. Task detail dynamic resolution
  const taskIdSegment = segments[0] === 'tasks' && segments[1] && UUID_RE.test(segments[1]) ? segments[1] : undefined;
  const { data: task } = useTask(taskIdSegment);

  // 2. Employee timesheet / detail dynamic resolution
  const employeeIndex = segments.findIndex((s) => s === 'employees' || s === 'employee');
  const employeeIdSegment =
    employeeIndex !== -1 && segments[employeeIndex + 1] && UUID_RE.test(segments[employeeIndex + 1])
      ? segments[employeeIndex + 1]
      : undefined;
  const { data: employeeTimesheet } = useEmployeeTimesheetDetail(employeeIdSegment);
  const { data: allUsers } = useUsers(undefined, true);

  // 3. Saved report dynamic resolution
  const reportIdSegment = segments[0] === 'reports' && segments[1] && UUID_RE.test(segments[1]) ? segments[1] : undefined;
  const { data: report } = useReport(reportIdSegment);

  const userList = (allUsers as Array<{ id?: string; fullName?: string; email?: string }>) || [];
  const employeeUser = employeeIdSegment ? userList.find((u) => u.id === employeeIdSegment) : undefined;
  const resolvedEmployeeName =
    employeeTimesheet?.[0]?.assignee_name ||
    employeeUser?.fullName ||
    employeeUser?.email ||
    'Employee Detail';

  const crumbs: { label: string; to: string }[] = [{ label: 'Home', to: '/' }];
  let path = '';

  for (let idx = 0; idx < segments.length; idx++) {
    const segment = segments[idx];
    path += `/${segment}`;

    if (UUID_RE.test(segment)) {
      if (segment === taskIdSegment) {
        crumbs.push({ label: task?.title ?? 'Task Details', to: path });
        continue;
      }
      if (segment === employeeIdSegment) {
        crumbs.push({ label: resolvedEmployeeName, to: path });
        continue;
      }
      if (segment === reportIdSegment) {
        crumbs.push({ label: report?.name ?? 'Report View', to: path });
        continue;
      }
      // Check if it's a known user ID (e.g. /admin/users/:id)
      const userMatch = userList.find((u) => u.id === segment);
      if (userMatch) {
        crumbs.push({ label: userMatch.fullName || userMatch.email || 'User Profile', to: path });
        continue;
      }
      // Never expose raw UUID in UI — use clean contextual fallback
      const prevSegment = segments[idx - 1];
      const fallbackLabel =
        prevSegment === 'departments'
          ? 'Department Details'
          : prevSegment === 'roles'
            ? 'Role Details'
            : 'Details';
      crumbs.push({ label: fallbackLabel, to: path });
      continue;
    }

    crumbs.push({ label: STATIC_LABELS[segment] ?? segment, to: path });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-slate-600 dark:text-slate-400">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="hover:text-slate-600 dark:hover:text-slate-400">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
