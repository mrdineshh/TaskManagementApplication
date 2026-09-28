import { useEffect, useState } from 'react';
import { Timer, Play, Pause, AlertTriangle, Clock, PlusCircle, Send } from 'lucide-react';

interface WorkSessionTimerProps {
  /** ISO timestamp — when the current in-progress session started. Null = timer stopped. */
  timerStartedAt: string | null;
  /** Minutes banked from all previous completed sessions. */
  totalLoggedMinutes: number;
  /** 'full' = My Tasks / Detail card. 'chip' = small inline row chip. */
  size?: 'full' | 'chip';
  /** Estimated effort in minutes — used to show progress + exceeded warning. */
  estimateMinutes?: number | null;
  /** Called when user submits an extended estimate (new hours value). */
  onExtendEstimate?: (hours: number) => Promise<void>;
  /** Called when user wants to submit task for review (estimate exceeded path). */
  onRequestReview?: () => void;
}

/** Format seconds into readable duration string (with optional seconds). */
function formatDuration(totalSecs: number, withSeconds: boolean): string {
  if (totalSecs <= 0) return withSeconds ? '0m 00s' : '0m';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  if (withSeconds) {
    const sStr = String(s).padStart(2, '0');
    if (h > 0) {
      const mStr = String(m).padStart(2, '0');
      return `${h}h ${mStr}m ${sStr}s`;
    }
    return `${m}m ${sStr}s`;
  }

  // Minute precision
  const mins = Math.floor(totalSecs / 60);
  if (mins <= 0) return '0m';
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${remMins}m`;
  if (remMins === 0) return `${hours}h`;
  return `${hours}h ${remMins}m`;
}

/**
 * Live work-session timer. Ticks every second when timerStartedAt is set.
 * Computes elapsed = (now - timerStartedAt) + totalLoggedMinutes.
 * Shows progress vs. estimate (green → amber → red) and a banner when exceeded.
 */
export function WorkSessionTimer({
  timerStartedAt,
  totalLoggedMinutes,
  size = 'full',
  estimateMinutes,
  onExtendEstimate,
  onRequestReview,
}: WorkSessionTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [showExtend, setShowExtend] = useState(false);
  const [extendHours, setExtendHours] = useState('');
  const [extending, setExtending] = useState(false);
  const isRunning = Boolean(timerStartedAt);

  useEffect(() => {
    if (!isRunning) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning, timerStartedAt]);

  const sessionMs = isRunning && timerStartedAt ? Math.max(0, now - new Date(timerStartedAt).getTime()) : 0;
  const sessionSeconds = Math.floor(sessionMs / 1000);
  const totalSeconds = totalLoggedMinutes * 60 + sessionSeconds;
  const totalMinutes = totalLoggedMinutes + Math.floor(sessionSeconds / 60);

  // Estimate progress — how far through the budget are we?
  const hasEstimate = estimateMinutes != null && estimateMinutes > 0;
  const progressPct = hasEstimate ? Math.min(100, (totalMinutes / estimateMinutes!) * 100) : 0;
  const isNearLimit = hasEstimate && progressPct >= 80 && progressPct < 100;
  const isExceeded = hasEstimate && totalMinutes > estimateMinutes!;

  // Dynamic color based on budget state
  const timeColor = isExceeded
    ? 'text-red-600 dark:text-red-400'
    : isNearLimit
      ? 'text-amber-600 dark:text-amber-400'
      : isRunning
        ? 'text-emerald-600 dark:text-emerald-400'
        : totalLoggedMinutes > 0
          ? 'text-slate-800 dark:text-slate-200'
          : 'text-slate-500 dark:text-slate-400';

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(extendHours);
    if (!h || h <= 0) return;
    setExtending(true);
    try {
      await onExtendEstimate?.(h);
      setShowExtend(false);
      setExtendHours('');
    } finally {
      setExtending(false);
    }
  }

  if (size === 'chip') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
          isExceeded
            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
            : isRunning
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-emerald-500/10'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}
      >
        {isExceeded ? (
          <AlertTriangle className="h-3 w-3" />
        ) : isRunning ? (
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
        ) : (
          <Timer className="h-3 w-3" />
        )}
        <span className="tabular-nums font-semibold">{formatDuration(totalSeconds, isRunning)}</span>
        {isExceeded && <span className="font-bold">!</span>}
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {/* Estimate-exceeded warning banner */}
      {isExceeded && (
        <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50/90 dark:bg-red-950/60 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-100 dark:bg-red-900/60 p-2 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-200">
                  Estimated time exceeded — timer paused
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  You've logged <strong>{formatDuration(totalMinutes * 60, false)}</strong> against an estimate of{' '}
                  <strong>{formatDuration(estimateMinutes! * 60, false)}</strong>.
                  {onExtendEstimate
                    ? ' Extend your estimate to resume work, or submit the task for review.'
                    : ' Please contact your manager to update the estimate.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {onExtendEstimate && (
                <button
                  type="button"
                  onClick={() => setShowExtend((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shadow-sm"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Extend Estimate
                </button>
              )}
              {onRequestReview && (
                <button
                  type="button"
                  onClick={onRequestReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit for Review
                </button>
              )}
            </div>
          </div>

          {/* Inline extend estimate form */}
          {showExtend && onExtendEstimate && (
            <form onSubmit={handleExtend} className="mt-3 flex items-center gap-2 pt-3 border-t border-red-200 dark:border-red-800/80">
              <span className="text-xs text-red-700 dark:text-red-300 font-medium shrink-0">New total estimate:</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={extendHours}
                onChange={(e) => setExtendHours(e.target.value)}
                placeholder="e.g. 8"
                className="w-24 rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <span className="text-xs text-red-600 dark:text-red-400">hours</span>
              <button
                type="submit"
                disabled={extending || !extendHours}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {extending ? 'Saving…' : 'Save & Resume'}
              </button>
              <button
                type="button"
                onClick={() => setShowExtend(false)}
                className="text-xs text-red-500 hover:underline"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      <div className={`neu-card p-5 sm:p-6 shadow-sm transition-all rounded-2xl ${isExceeded ? 'border border-red-200 dark:border-red-900/50' : ''}`}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-2.5 shrink-0 ${
                isExceeded
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                  : isRunning
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                    : totalLoggedMinutes > 0
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {isExceeded ? (
                <AlertTriangle className="h-4 w-4" />
              ) : isRunning ? (
                <Play className="h-4 w-4 fill-current animate-pulse" />
              ) : totalLoggedMinutes > 0 ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Timer className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Work Timer</span>
                {isRunning && !isExceeded && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    LIVE
                  </span>
                )}
                {isExceeded && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                    OVER BUDGET
                  </span>
                )}
                {isNearLimit && !isExceeded && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    <Clock className="h-3 w-3" />
                    NEARING LIMIT
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isExceeded
                  ? 'Timer auto-paused — estimate exceeded'
                  : isRunning
                    ? 'Work session actively recording'
                    : totalLoggedMinutes > 0
                      ? 'Timer paused between sessions'
                      : 'Timer starts when moved to In Progress'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${timeColor}`}>
              {formatDuration(totalSeconds, isRunning && !isExceeded)}
            </span>
            {isRunning && sessionSeconds > 0 && !isExceeded && (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                current session: +{formatDuration(sessionSeconds, true)}
              </div>
            )}
            {hasEstimate && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums font-medium">
                of {formatDuration(estimateMinutes! * 60, false)} estimated
              </div>
            )}
          </div>
        </div>

        {/* Progress bar vs estimate */}
        {hasEstimate && (
          <div className="my-3.5">
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isExceeded
                    ? 'bg-red-500'
                    : isNearLimit
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">0</span>
              <span className={`text-[10px] font-semibold ${isExceeded ? 'text-red-500' : 'text-slate-400'}`}>
                {Math.round(progressPct)}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{formatDuration(estimateMinutes! * 60, false)}</span>
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">
            {isExceeded ? (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Estimate exceeded by {formatDuration((totalMinutes - estimateMinutes!) * 60, false)}
              </span>
            ) : isRunning ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Session active &amp; ticking
              </span>
            ) : totalLoggedMinutes > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>⏸</span> Work paused ({formatDuration(totalLoggedMinutes * 60, false)} banked)
              </span>
            ) : (
              <span>Not started</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
