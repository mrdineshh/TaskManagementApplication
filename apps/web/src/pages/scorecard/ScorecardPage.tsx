import { useState, useEffect } from "react";
import { TrendingUp, Trophy, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { useDepartments, useLeaderboard, useMyScorecard, useUserScorecard } from "../../features/tasks/hooks";
import { useSessionStore } from "../../lib/auth/session-store";
import { DateRangePicker, resolvePreset, type DateRangeResult } from "../../components/DateRangePicker";
import { NeuSelect } from "../../components/NeuSelect";

function defaultDateRange(): DateRangeResult {
  const { start, end } = resolvePreset("this_month");
  return { preset: "this_month", start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const SUB_SCORE_LABELS: Record<string, string> = {
  on_time_rate:      "On-time",
  estimate_accuracy: "Estimate",
  volume:            "Volume",
  overdue:           "Overdue",
  over_budget:       "Over Budget",
  rework:            "Rework",
};

const SUB_SCORE_COLORS: Record<string, string> = {
  on_time_rate:      "#2563EB",
  estimate_accuracy: "#8b5cf6",
  volume:            "#10b981",
  overdue:           "#ef4444",
  over_budget:       "#f59e0b",
  rework:            "#f97316",
};

function subScoreDetail(key: string, raw: Record<string, number | null>): { label: string; value: string | number }[] {
  switch (key) {
    case "on_time_rate":      return [{ label: "Completed on time", value: raw.on_time_count ?? 0 }, { label: "Total (with due date)", value: raw.completed_count ?? 0 }];
    case "estimate_accuracy": return [{ label: "Avg. estimate error", value: raw.avg_estimate_error_pct === null ? "n/a" : `${raw.avg_estimate_error_pct}%` }];
    case "volume":            return [{ label: "Tasks completed", value: raw.completed_count ?? 0 }];
    case "overdue":           return [{ label: "Overdue at completion (or now)", value: raw.overdue_count ?? 0 }];
    case "over_budget":       return [{ label: "Went over time estimate", value: raw.over_budget_count ?? 0 }];
    case "rework":            return [{ label: "Reopened after completion", value: raw.reworked_count ?? 0 }];
    default:                  return [];
  }
}

function ScoreRing({ score }: { score: number }) {
  const pct  = Math.min(100, Math.max(0, score));
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#2563EB" : pct >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--neu-dark)" strokeWidth="7" />
        <circle
          cx="45" cy="45" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-bold" style={{ color }}>{score}</p>
        <p className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>/ 100</p>
      </div>
    </div>
  );
}

function ScorecardSection({ userId, userName, onBack }: { userId?: string; userName?: string; onBack?: () => void }) {
  const [dateRange, setDateRange] = useState<DateRangeResult>(defaultDateRange());
  const [expandedKey, setExpandedKey] = useState<string | undefined>(undefined);

  const startIso = `${dateRange.start}T00:00:00.000Z`;
  const endIso   = `${dateRange.end}T23:59:59.999Z`;
  const mine     = useMyScorecard(startIso, endIso);
  const forUser  = useUserScorecard(userId, startIso, endIso);
  const { data, isLoading } = userId ? forUser : mine;

  return (
    <div className="neu-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="nav-icon-btn w-8 h-8">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {userName ? `${userName}'s Scorecard` : "My Scorecard"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Click a tile to expand details</p>
          </div>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="h-12 w-12 rounded-full skeleton" />
        </div>
      )}
      {!isLoading && !data && (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-faint)" }}>No scorecard data for this range.</p>
      )}
      {data && (
        <div className="space-y-4">
          {/* Overall score ring */}
          <div className="flex items-center gap-6">
            <ScoreRing score={data.overall_score ?? 0} />
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>Overall Score</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Composite performance index</p>
            </div>
          </div>

          {/* Sub-score tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(data.sub_scores ?? {}).map(([key, value]) => {
              const expanded = expandedKey === key;
              const color    = SUB_SCORE_COLORS[key] ?? "#2563EB";
              return (
                <button
                  key={key}
                  onClick={() => setExpandedKey(expanded ? undefined : key)}
                  className="rounded-2xl p-4 text-left transition-all bg-white dark:bg-slate-900 shadow-2xs"
                  style={expanded
                    ? { border: `2px solid ${color}`, boxShadow: `0 4px 14px ${color}25` }
                    : { border: "2px solid #e2e8f0" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {SUB_SCORE_LABELS[key] ?? key}
                    </p>
                  </div>
                  <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{Number(value ?? 0)}</p>
                  {expanded && <ChevronRight className="w-3.5 h-3.5 mt-1 rotate-90" style={{ color }} />}
                </button>
              );
            })}
          </div>

          {/* Expanded detail */}
          {expandedKey && data.raw && (
            <div
              className="rounded-xl px-4 py-3 animate-fade-in bg-white dark:bg-slate-900 shadow-2xs"
              style={{ border: `2px solid ${SUB_SCORE_COLORS[expandedKey] ?? "#2563EB"}` }}
            >
              {subScoreDetail(expandedKey, (data.raw ?? {}) as unknown as Record<string, number | null>).map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.label}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScorecardPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId]     = useState(currentUser?.primary_department_id ?? "");
  const [viewing, setViewing]               = useState<{ id: string; name: string } | undefined>(undefined);
  const [leaderboardRange, setLeaderboardRange] = useState<DateRangeResult>(defaultDateRange());

  useEffect(() => {
    if (!departmentId && departments && departments.length > 0) {
      const match = departments.find((d) => d.id === currentUser?.primary_department_id);
      setDepartmentId(match ? match.id : departments[0].id);
    }
  }, [departments, currentUser?.primary_department_id, departmentId]);

  const startIso = `${leaderboardRange.start}T00:00:00.000Z`;
  const endIso   = `${leaderboardRange.end}T23:59:59.999Z`;
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(departmentId || undefined, startIso, endIso);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="icon-box-brand">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl">Scorecard</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Performance metrics & department leaderboard</p>
        </div>
      </div>

      <ScorecardSection userId={viewing?.id} userName={viewing?.name} onBack={viewing ? () => setViewing(undefined) : undefined} />

      {/* Leaderboard */}
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>Department Leaderboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker value={leaderboardRange} onChange={setLeaderboardRange} />
            <NeuSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={(departments ?? []).map((dept) => ({ value: dept.id, label: dept.name }))}
              compact
              style={{ minWidth: "10rem" }}
            />
          </div>
        </div>

        {leaderboardLoading && (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl skeleton" />)}
          </div>
        )}

        <ol className="divide-y" style={{ "--tw-divide-opacity": 1 } as any}>
          {leaderboard?.map((entry) => {
            const isMe   = entry.user_id === currentUser?.id;
            const isTop3 = entry.rank <= 3;
            const rankColors = ["#f59e0b", "#94a3b8", "#cd7c3a"];
            return (
              <li key={entry.user_id} style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                <button
                  onClick={() => setViewing({ id: entry.user_id, name: entry.full_name })}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-all hover:bg-[rgba(37,99,235,0.03)]"
                  style={isMe ? { background: "rgba(37,99,235,0.04)" } : undefined}
                >
                  <span
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold shrink-0 bg-white dark:bg-slate-900 shadow-2xs"
                    style={isTop3
                      ? { border: `2px solid ${rankColors[entry.rank - 1]}`, color: rankColors[entry.rank - 1] }
                      : { border: "2px solid #cbd5e1", color: "var(--text-faint)", fontWeight: 600 }}
                  >
                    {isTop3 ? <Trophy className="w-3.5 h-3.5" /> : `#${entry.rank}`}
                  </span>
                  <span className="flex-1 font-semibold text-sm" style={{ color: isMe ? "#2563EB" : "var(--text-primary)" }}>
                    {entry.full_name}
                    {isMe && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest opacity-60">(you)</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 w-32">
                      <div className="flex-1 neu-progress-track h-1.5">
                        <div
                          className="neu-progress-fill"
                          style={{ width: `${entry.overall_score}%`, background: isTop3 ? `linear-gradient(90deg, ${rankColors[entry.rank - 1]}, ${rankColors[entry.rank - 1]}aa)` : "linear-gradient(90deg, #2563EB, #7367f0)" }}
                        />
                      </div>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: "#2563EB", minWidth: "2.5rem", textAlign: "right" }}>
                      {entry.overall_score}
                    </span>
                    <BarChart2 className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{ color: "var(--text-faint)" }} />
                  </div>
                </button>
              </li>
            );
          })}
          {leaderboard?.length === 0 && (
            <li className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No data for this range.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
