import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDepartments, useTasks } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { NewTaskForm } from '../../features/tasks/NewTaskForm';

/**
 * Filterable/sortable task list — the v1 baseline view (docs/05-FEATURES.md §1.2), and the
 * drill-down landing page (docs/10-OPEN-DECISIONS.md §M5): Team Dashboard and Scorecard link
 * here with department_id/assignee_id/overdue/over_budget already set in the URL, so a click
 * on a dashboard number lands on exactly that slice of tasks, not a fresh unfiltered list.
 */
export function TaskListPage() {
  const [params, setParams] = useSearchParams();
  const [showNewTask, setShowNewTask] = useState(false);
  const departmentId = params.get('department_id') ?? undefined;
  const assigneeIds = params.get('assignee_id') ?? undefined;
  const overdue = params.get('overdue') === 'true';
  const overBudget = params.get('over_budget') === 'true';
  const hasDrillFilters = Boolean(assigneeIds || overdue || overBudget);

  const { data: departments } = useDepartments();
  const { data, isLoading } = useTasks({
    department_id: departmentId,
    assignee_id: assigneeIds,
    overdue: overdue ? 'true' : undefined,
    over_budget: overBudget ? 'true' : undefined,
  });

  // Free label derivation (docs §M5) — the loaded rows already carry assignee names, so a
  // single-person drill ("Ada Admin's tasks") needs no extra request; a multi-person drill
  // (a manager's whole team) falls back to a count.
  const assigneeLabel = useMemo(() => {
    if (!assigneeIds || !data?.items.length) return null;
    const ids = assigneeIds.split(',');
    if (ids.length === 1) {
      const name = (data.items[0] as any)?.assignee?.full_name;
      return name ? `${name}'s tasks` : '1 person';
    }
    return `${ids.length} team members`;
  }, [assigneeIds, data]);

  const departmentName = departments?.find((dep) => dep.id === departmentId)?.name;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">All Tasks</h1>
        <button
          onClick={() => setShowNewTask((v) => !v)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showNewTask ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showNewTask && (
        <div className="mb-4">
          <NewTaskForm onDone={() => setShowNewTask(false)} />
        </div>
      )}

      {hasDrillFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40 px-3 py-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Filtered:</span>
          {departmentName && <span className="font-medium text-slate-700 dark:text-slate-200">{departmentName}</span>}
          {assigneeLabel && <span className="font-medium text-slate-700 dark:text-slate-200">{assigneeLabel}</span>}
          {overdue && <span className="rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">Overdue</span>}
          {overBudget && (
            <span className="rounded-full bg-orange-100 dark:bg-orange-950 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">Over budget</span>
          )}
          <button onClick={() => setParams({})} className="ml-auto text-xs text-brand-700 dark:text-brand-300 hover:underline">
            Clear filters
          </button>
        </div>
      )}

      <div className="mb-4">
        <select
          value={departmentId ?? ''}
          onChange={(e) => setParams(e.target.value ? { department_id: e.target.value } : {})}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Assignee</th>
              <th className="px-4 py-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No tasks found.
                </td>
              </tr>
            )}
            {data?.items.map((t: any) => (
              <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-950">
                <td className="px-4 py-2">
                  <Link to={`/tasks/${t.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{t.department?.name}</td>
                <td className="px-4 py-2">{t.status && <Badge label={t.status.label} color={t.status.color} />}</td>
                <td className="px-4 py-2">{t.priority && <Badge label={t.priority.label} color={t.priority.color} />}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{t.assignee?.full_name ?? '—'}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
