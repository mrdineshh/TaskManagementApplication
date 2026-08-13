import { Link } from 'react-router-dom';
import { usePersonalDashboard } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';

/** "My Tasks" — default landing view for individual contributors (docs/05-FEATURES.md §1.2). */
export function MyTasksPage() {
  const { data, isLoading } = usePersonalDashboard();

  if (isLoading) return <p className="text-slate-400">Loading…</p>;
  const d = data as any;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">My Tasks</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Overdue" value={d.overdue_count} tone="text-red-600" />
        <StatCard label="Over budget" value={d.over_budget_count} tone="text-orange-600" />
        <StatCard label="Due this week" value={d.due_this_week_count} tone="text-amber-600" />
        <StatCard label="Open" value={d.open_tasks.length} tone="text-brand-600" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Open tasks</h2>
        <ul>
          {d.open_tasks.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
              <Link to={`/tasks/${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                {t.title}
              </Link>
              <div className="flex items-center gap-2">
                {t.status && <Badge label={t.status.label} color={t.status.color} />}
                {t.due_date && <span className="text-xs text-slate-400">{new Date(t.due_date).toLocaleDateString()}</span>}
              </div>
            </li>
          ))}
          {d.open_tasks.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nothing open — nice work.</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Recently completed</h2>
        <ul>
          {d.recently_completed.map((t: any) => (
            <li key={t.id} className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500 last:border-0">
              {t.title}
            </li>
          ))}
          {d.recently_completed.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">None yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
