import { useState } from 'react';
import { useDepartmentDashboard, useDepartments } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';

/** Manager-facing department view — task counts, overdue, workload (docs/05-FEATURES.md §1.6). */
export function TeamDashboardPage() {
  const { data: departments } = useDepartments();
  const currentUser = useSessionStore((s) => s.currentUser);
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');
  const { data, isLoading } = useDepartmentDashboard(departmentId || undefined);
  const d = data as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Team Dashboard</h1>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {departments?.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}

      {d && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Overdue</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{d.overdue_count}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Over budget</p>
              <p className="mt-1 text-2xl font-semibold text-orange-600">{d.over_budget_count}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Statuses tracked</p>
              <p className="mt-1 text-2xl font-semibold text-brand-600">{d.counts_by_status.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Workload by assignee</h2>
            <ul>
              {d.workload_by_assignee.map((w: any) => (
                <li key={w.assignee_id ?? 'unassigned'} className="flex justify-between border-b border-slate-100 px-4 py-2 text-sm last:border-0">
                  <span className="text-slate-600">{w.assignee_id ?? 'Unassigned'}</span>
                  <span className="font-medium text-slate-900">{w.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Recently created</h2>
            <ul>
              {d.recently_created.map((t: any) => (
                <li key={t.id} className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600 last:border-0">
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
