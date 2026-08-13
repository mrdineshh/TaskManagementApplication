import { useState } from 'react';
import { useDepartments, useLeaderboard, useMyScorecard } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const SUB_SCORE_LABELS: Record<string, string> = {
  on_time_rate: 'On-time completion',
  estimate_accuracy: 'Estimate accuracy',
  volume: 'Volume',
  overdue: 'Overdue (inverse)',
  over_budget: 'Over budget (inverse)',
  rework: 'Rework (inverse)',
};

/**
 * Employee scorecard + department leaderboard (docs/10-OPEN-DECISIONS.md §J). Visible to
 * everyone by design — no permission gating beyond basic task.view — since the goal is
 * transparent, healthy competition, not a private manager-only report.
 */
export function ScorecardPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');

  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T23:59:59.999Z`;

  const { data: mine, isLoading: mineLoading } = useMyScorecard(startIso, endIso);
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(departmentId || undefined, startIso, endIso);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Scorecard</h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">From</label>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          />
          <label className="text-slate-500">To</label>
          <input
            type="date"
            value={end}
            min={start}
            max={isoDaysAgo(0)}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">My scorecard</h2>
        {mineLoading && <p className="mt-3 text-sm text-slate-400">Loading…</p>}
        {mine && (
          <>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-brand-600">{mine.overall_score}</span>
              <span className="text-sm text-slate-400">overall score (0-100)</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(mine.sub_scores).map(([key, value]) => (
                <div key={key} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-400">{SUB_SCORE_LABELS[key] ?? key}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
              <div>
                <dt className="inline text-slate-400">Completed: </dt>
                <dd className="inline font-medium text-slate-700">{mine.raw.completed_count}</dd>
              </div>
              <div>
                <dt className="inline text-slate-400">On time: </dt>
                <dd className="inline font-medium text-slate-700">{mine.raw.on_time_count}</dd>
              </div>
              <div>
                <dt className="inline text-slate-400">Overdue: </dt>
                <dd className="inline font-medium text-slate-700">{mine.raw.overdue_count}</dd>
              </div>
              <div>
                <dt className="inline text-slate-400">Over budget: </dt>
                <dd className="inline font-medium text-slate-700">{mine.raw.over_budget_count}</dd>
              </div>
              <div>
                <dt className="inline text-slate-400">Reworked: </dt>
                <dd className="inline font-medium text-slate-700">{mine.raw.reworked_count}</dd>
              </div>
              {mine.raw.avg_estimate_error_pct !== null && (
                <div>
                  <dt className="inline text-slate-400">Avg estimate error: </dt>
                  <dd className="inline font-medium text-slate-700">{mine.raw.avg_estimate_error_pct}%</dd>
                </div>
              )}
            </dl>
          </>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Department leaderboard</h2>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {departments?.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        {leaderboardLoading && <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>}
        <ol>
          {leaderboard?.map((entry) => (
            <li
              key={entry.user_id}
              className={`flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0 ${
                entry.user_id === currentUser?.id ? 'bg-brand-50' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="w-6 text-right font-semibold text-slate-400">#{entry.rank}</span>
                <span className="font-medium text-slate-800">{entry.full_name}</span>
              </span>
              <span className="font-semibold text-brand-600">{entry.overall_score}</span>
            </li>
          ))}
          {leaderboard?.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No data for this range.</li>}
        </ol>
      </section>
    </div>
  );
}
