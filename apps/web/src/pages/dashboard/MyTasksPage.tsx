import { Link } from 'react-router-dom';
import { usePersonalDashboard } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';

/** "My Tasks" — default landing view for individual contributors (docs/05-FEATURES.md §1.2). */
export function MyTasksPage() {
  const { data, isLoading } = usePersonalDashboard();

  if (isLoading) return <p className="text-slate-400 dark:text-slate-500">Loading…</p>;
  const d = data as any;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Tasks</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Overdue" value={d.overdue_count} tone="text-red-600 dark:text-red-400" />
        <StatCard label="Over budget" value={d.over_budget_count} tone="text-orange-600 dark:text-orange-400" />
        <StatCard label="Due this week" value={d.due_this_week_count} tone="text-amber-600 dark:text-amber-400" />
        <StatCard label="Open" value={d.open_tasks.length} tone="text-brand-600 dark:text-brand-400" />
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Open tasks</h2>
        <ul>
          {d.open_tasks.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 last:border-0">
              <Link to={`/tasks/${t.id}`} className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
                {t.title}
              </Link>
              <div className="flex items-center gap-2">
                {t.status && <Badge label={t.status.label} color={t.status.color} />}
                {t.due_date && <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(t.due_date).toLocaleDateString()}</span>}
              </div>
            </li>
          ))}
          {d.open_tasks.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Nothing open — nice work.</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Recently completed</h2>
        <ul>
          {d.recently_completed.map((t: any) => (
            <li key={t.id} className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-slate-500 dark:text-slate-400 last:border-0">
              {t.title}
            </li>
          ))}
          {d.recently_completed.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">None yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
