import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamDashboard } from '../../features/tasks/hooks';

interface StatusCount {
  status_id: string;
  label: string;
  color: string | null;
  count: number;
}
interface TeamStats {
  counts_by_status: StatusCount[];
  overdue_count: number;
  over_budget_count: number;
  open_count: number;
}
interface Member {
  id: string;
  full_name?: string;
  fullName?: string;
  manager_id?: string;
  managerId?: string;
}
interface ManagerBreakdown extends TeamStats {
  manager_id: string;
  manager_name: string;
  member_count: number;
}
interface DepartmentSummary extends TeamStats {
  department_id: string;
  department_name: string;
  member_count: number;
}

function StatusBadges({ statuses }: { statuses: StatusCount[] }) {
  if (statuses.length === 0) return <span className="text-xs text-slate-400 dark:text-slate-500">No open tasks</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {statuses.map((s) => (
        <span
          key={s.status_id}
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${s.color ?? '#94a3b8'}20`, color: s.color ?? '#475569' }}
        >
          {s.label}: {s.count}
        </span>
      ))}
    </div>
  );
}

/**
 * Drill-down stat row (docs/10-OPEN-DECISIONS.md §M5) — Overdue/Over budget counts link
 * straight into the same slice of the task list, using the tasks endpoint's overdue/
 * over_budget filters (which share the exact business-day/logged-vs-estimate definition
 * these counts are computed from, so the number clicked equals the number of rows landed on).
 */
function StatRow({ stats, linkParams }: { stats: TeamStats; linkParams: Record<string, string> | null }) {
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...linkParams, ...extra }).toString();
  const Overdue = linkParams ? (
    <Link to={`/tasks?${qs({ overdue: 'true' })}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
      Overdue: <span className="font-medium text-red-600 dark:text-red-400">{stats.overdue_count}</span>
    </Link>
  ) : (
    <span>
      Overdue: <span className="font-medium text-red-600 dark:text-red-400">{stats.overdue_count}</span>
    </span>
  );
  const OverBudget = linkParams ? (
    <Link to={`/tasks?${qs({ over_budget: 'true' })}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
      Over budget: <span className="font-medium text-orange-600 dark:text-orange-400">{stats.over_budget_count}</span>
    </Link>
  ) : (
    <span>
      Over budget: <span className="font-medium text-orange-600 dark:text-orange-400">{stats.over_budget_count}</span>
    </span>
  );
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
      <span>
        Open: <span className="font-medium text-slate-700 dark:text-slate-300">{stats.open_count}</span>
      </span>
      {Overdue}
      {OverBudget}
    </div>
  );
}

function Breadcrumb({ trail }: { trail: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      {trail.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          {crumb.onClick ? (
            <button onClick={crumb.onClick} className="text-brand-700 dark:text-brand-300 hover:underline">
              {crumb.label}
            </button>
          ) : (
            <span className={i === trail.length - 1 ? 'font-medium text-slate-600 dark:text-slate-300' : ''}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function memberName(m: Member) {
  return m.full_name ?? m.fullName ?? 'Unknown';
}

/**
 * Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K) — the same page renders entirely
 * different content depending on the caller's active role, reading whichever shape
 * `/dashboards/team` returns for that role rather than the page picking a scope itself.
 * Drill-down (§M5): Org → Department → Manager → Member → Tasks, terminating in the existing
 * task list filtered by department_id/assignee_id — no new endpoint needed for the hierarchy
 * itself, since /dashboards/team already returns every department member with their managerId.
 */
export function TeamDashboardPage() {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [expandedManagerId, setExpandedManagerId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useTeamDashboard(departmentId);
  const d = data as any;

  if (isLoading) return <p className="text-slate-400 dark:text-slate-500">Loading…</p>;

  if (!d || d.scope === 'none') {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
        No team view for your current role.
      </div>
    );
  }

  if (d.scope === 'manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Team</h1>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <StatusBadges statuses={d.counts_by_status} />
          <StatRow stats={d} linkParams={d.members.length ? { assignee_id: d.members.map((m: Member) => m.id).join(',') } : null} />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Direct reports ({d.members.length})</h2>
          <ul>
            {d.members.map((m: Member) => (
              <li key={m.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <Link
                  to={`/tasks?assignee_id=${m.id}`}
                  className="block px-4 py-3 text-sm text-brand-700 dark:text-brand-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:underline"
                >
                  {memberName(m)}
                </Link>
              </li>
            ))}
            {d.members.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No direct reports assigned yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  if (d.scope === 'department') {
    const membersByManager = (managerId: string) => (d.members as Member[]).filter((m) => (m.manager_id ?? m.managerId) === managerId);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb
            trail={[
              { label: 'Organization', onClick: departmentId ? () => setDepartmentId(undefined) : undefined },
              { label: d.department_name },
            ]}
          />
          <Link to={`/scorecard`} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
            View leaderboard →
          </Link>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{d.department_name}</h1>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <StatusBadges statuses={d.counts_by_status} />
          <StatRow stats={d} linkParams={{ department_id: d.department_id }} />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">By manager</h2>
          <ul>
            {d.by_manager.map((m: ManagerBreakdown) => {
              const expanded = expandedManagerId === m.manager_id;
              const reports = membersByManager(m.manager_id);
              return (
                <li key={m.manager_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="px-4 py-3">
                    <button
                      onClick={() => setExpandedManagerId(expanded ? undefined : m.manager_id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        <span className={`inline-block text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
                        {m.manager_name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{m.member_count} direct reports</span>
                    </button>
                    <StatRow stats={m} linkParams={reports.length ? { assignee_id: reports.map((r) => r.id).join(',') } : null} />
                  </div>
                  {expanded && (
                    <ul className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      {reports.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={`/tasks?assignee_id=${r.id}`}
                            className="block px-8 py-2 text-sm text-brand-700 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:underline"
                          >
                            {memberName(r)}
                          </Link>
                        </li>
                      ))}
                      {reports.length === 0 && <li className="px-8 py-3 text-xs text-slate-400 dark:text-slate-500">No direct reports.</li>}
                    </ul>
                  )}
                </li>
              );
            })}
            {d.by_manager.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No managers assigned in this department yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  // scope === 'org' — Management/Admin, cross-department summary with drill-down.
  return (
    <div className="space-y-4">
      <Breadcrumb trail={[{ label: 'Organization' }]} />
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Organization</h1>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">By department</h2>
        <ul>
          {d.departments.map((dept: DepartmentSummary) => (
            <li key={dept.department_id} className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-sm last:border-0">
              <button onClick={() => setDepartmentId(dept.department_id)} className="flex w-full items-center justify-between text-left">
                <span className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{dept.department_name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{dept.member_count} members</span>
              </button>
              <StatRow stats={dept} linkParams={{ department_id: dept.department_id }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
