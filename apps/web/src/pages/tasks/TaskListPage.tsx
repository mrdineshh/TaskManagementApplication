import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDepartments, useTasks } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { NewTaskForm } from '../../features/tasks/NewTaskForm';

/** Filterable/sortable task list — the v1 baseline view (docs/05-FEATURES.md §1.2). */
export function TaskListPage() {
  const [params, setParams] = useSearchParams();
  const [showNewTask, setShowNewTask] = useState(false);
  const departmentId = params.get('department_id') ?? undefined;

  const { data: departments } = useDepartments();
  const { data, isLoading } = useTasks({ department_id: departmentId });

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
