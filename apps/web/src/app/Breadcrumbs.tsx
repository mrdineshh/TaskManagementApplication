import { Link, useLocation } from 'react-router-dom';
import { useTask } from '../features/tasks/hooks';

const STATIC_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  board: 'Kanban',
  timeline: 'Timeline',
  team: 'Team',
  scorecard: 'Scorecard',
  reports: 'Reports',
  builder: 'Report Builder',
  edit: 'Edit',
  notifications: 'Notifications',
  settings: 'Settings',
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
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Full-path breadcrumbs (docs/10-OPEN-DECISIONS.md's Phase 5 nav requirement — "there should
 * be a proper breadcrumb"). Derived from the route rather than hand-maintained per page, so
 * it can't drift out of sync with App.tsx's route tree; the one dynamic case (a task's title
 * on its detail page) is fetched via the same cached useTask() query the page itself uses, so
 * this never triggers an extra request.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const taskIdSegment = segments[0] === 'tasks' && segments[1] && UUID_RE.test(segments[1]) ? segments[1] : undefined;
  const { data: task } = useTask(taskIdSegment);

  if (segments.length === 0) return null; // nothing to show on the landing page itself

  const crumbs: { label: string; to: string }[] = [{ label: 'Home', to: '/' }];
  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    if (segment === taskIdSegment) {
      crumbs.push({ label: task?.title ?? 'Task', to: path });
      continue;
    }
    crumbs.push({ label: STATIC_LABELS[segment] ?? segment, to: path });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-slate-600">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="hover:text-slate-600">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
