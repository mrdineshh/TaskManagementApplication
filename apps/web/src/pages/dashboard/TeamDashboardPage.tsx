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

function StatRow({ stats }: { stats: TeamStats }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
      <span>
        Open: <span className="font-medium text-slate-700 dark:text-slate-300">{stats.open_count}</span>
      </span>
      <span>
        Overdue: <span className="font-medium text-red-600 dark:text-red-400">{stats.overdue_count}</span>
      </span>
      <span>
        Over budget: <span className="font-medium text-orange-600 dark:text-orange-400">{stats.over_budget_count}</span>
      </span>
    </div>
  );
}

/**
 * Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K) — the same page renders entirely
 * different content depending on the caller's active role, reading whichever shape
 * `/dashboards/team` returns for that role rather than the page picking a scope itself.
 */
export function TeamDashboardPage() {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
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
          <StatRow stats={d} />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Direct reports ({d.members.length})</h2>
          <ul>
            {d.members.map((m: { id: string; fullName?: string; full_name?: string }) => (
              <li key={m.id} className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 last:border-0">
                {(m as any).full_name ?? (m as any).fullName}
              </li>
            ))}
            {d.members.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No direct reports assigned yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  if (d.scope === 'department') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {departmentId && (
              <button onClick={() => setDepartmentId(undefined)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                ← All departments
              </button>
            )}
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{d.department_name}</h1>
          </div>
          <Link to={`/scorecard`} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
            View leaderboard →
          </Link>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <StatusBadges statuses={d.counts_by_status} />
          <StatRow stats={d} />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">By manager</h2>
          <ul>
            {d.by_manager.map((m: ManagerBreakdown) => (
              <li key={m.manager_id} className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{m.manager_name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{m.member_count} direct reports</span>
                </div>
                <StatRow stats={m} />
              </li>
            ))}
            {d.by_manager.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No managers assigned in this department yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  // scope === 'org' — Management/Admin, cross-department summary with drill-down.
  return (
    <div className="space-y-6">
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
              <StatRow stats={dept} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
