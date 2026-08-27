import { useState } from 'react';
import { useDepartments, useLeaderboard, useMyScorecard, useUserScorecard } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';
import { DateRangePicker, resolvePreset, type DateRangeResult } from '../../components/DateRangePicker';

function defaultDateRange(): DateRangeResult {
  const { start, end } = resolvePreset('this_month');
  return { preset: 'this_month', start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const SUB_SCORE_LABELS: Record<string, string> = {
  on_time_rate: 'On-time completion',
  estimate_accuracy: 'Estimate accuracy',
  volume: 'Volume',
  overdue: 'Overdue (inverse)',
  over_budget: 'Over budget (inverse)',
  rework: 'Rework (inverse)',
};

// What each sub-score's "see details" expansion shows — the specific raw counters (already
// returned alongside sub_scores) that number was computed from (docs/10-OPEN-DECISIONS.md
// §M5). No task-list link here: the scorecard's overdue/over_budget are a date-range-scoped
// historical count, a genuinely different definition from the tasks endpoint's live overdue/
// over_budget filters used elsewhere on this drill — linking them would show a task list whose
// count doesn't match the number just clicked.
function subScoreDetail(key: string, raw: Record<string, number | null>): { label: string; value: string | number }[] {
  switch (key) {
    case 'on_time_rate':
      return [
        { label: 'Completed on time', value: raw.on_time_count ?? 0 },
        { label: 'Completed (with a due date)', value: raw.completed_count ?? 0 },
      ];
    case 'estimate_accuracy':
      return [{ label: 'Avg. estimate error', value: raw.avg_estimate_error_pct === null ? 'n/a' : `${raw.avg_estimate_error_pct}%` }];
    case 'volume':
      return [{ label: 'Tasks completed', value: raw.completed_count ?? 0 }];
    case 'overdue':
      return [{ label: 'Overdue at completion (or now, if still open)', value: raw.overdue_count ?? 0 }];
    case 'over_budget':
      return [{ label: 'Went over their time estimate', value: raw.over_budget_count ?? 0 }];
    case 'rework':
      return [{ label: 'Reopened after completion', value: raw.reworked_count ?? 0 }];
    default:
      return [];
  }
}

function ScorecardSection({ userId, userName, onBack }: { userId?: string; userName?: string; onBack?: () => void }) {
  const [dateRange, setDateRange] = useState<DateRangeResult>(defaultDateRange());
  const [expandedKey, setExpandedKey] = useState<string | undefined>(undefined);

  const startIso = `${dateRange.start}T00:00:00.000Z`;
  const endIso = `${dateRange.end}T23:59:59.999Z`;

  const mine = useMyScorecard(startIso, endIso);
  const forUser = useUserScorecard(userId, startIso, endIso);
  const { data, isLoading } = userId ? forUser : mine;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
              ← My scorecard
            </button>
          )}
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{userName ? `${userName}'s scorecard` : 'My scorecard'}</h2>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading && <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Loading…</p>}
      {!isLoading && !data && <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">No scorecard data for this range.</p>}
      {data && (
        <>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl font-bold text-brand-600 dark:text-brand-400">{data.overall_score}</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">overall score (0-100)</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click a tile to see what it's made of.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(data.sub_scores).map(([key, value]) => {
              const expanded = expandedKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setExpandedKey(expanded ? undefined : key)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    expanded
                      ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950/40'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">{SUB_SCORE_LABELS[key] ?? key}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-200">{value as number}</p>
                </button>
              );
            })}
          </div>
          {expandedKey && (
            <dl className="mt-3 rounded-md border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/30 p-3 text-xs">
              {subScoreDetail(expandedKey, data.raw as unknown as Record<string, number | null>).map((row) => (
                <div key={row.label} className="flex items-center justify-between py-0.5">
                  <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Employee scorecard + department leaderboard (docs/10-OPEN-DECISIONS.md §J). Visible to
 * everyone by design — no permission gating beyond basic task.view — since the goal is
 * transparent, healthy competition, not a private manager-only report. Drill-down (§M5):
 * leaderboard rows open that person's own scorecard (reusing GET /scorecards/users/:id,
 * already implemented but previously unused by any page); sub-score tiles expand in place.
 */
export function ScorecardPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');
  const [viewing, setViewing] = useState<{ id: string; name: string } | undefined>(undefined);
  const [leaderboardRange, setLeaderboardRange] = useState<DateRangeResult>(defaultDateRange());

  const startIso = `${leaderboardRange.start}T00:00:00.000Z`;
  const endIso = `${leaderboardRange.end}T23:59:59.999Z`;
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(departmentId || undefined, startIso, endIso);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Scorecard</h1>

      <ScorecardSection userId={viewing?.id} userName={viewing?.name} onBack={viewing ? () => setViewing(undefined) : undefined} />

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Department leaderboard</h2>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={leaderboardRange} onChange={setLeaderboardRange} />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
            >
              {departments?.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {leaderboardLoading && <p className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>}
        <ol>
          {leaderboard?.map((entry) => (
            <li key={entry.user_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <button
                onClick={() => setViewing({ id: entry.user_id, name: entry.full_name })}
                className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-950 ${
                  entry.user_id === currentUser?.id ? 'bg-brand-50 dark:bg-brand-950/40' : ''
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-semibold text-slate-400 dark:text-slate-500">#{entry.rank}</span>
                  <span className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{entry.full_name}</span>
                </span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">{entry.overall_score}</span>
              </button>
            </li>
          ))}
          {leaderboard?.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No data for this range.</li>}
        </ol>
      </section>
    </div>
  );
}
