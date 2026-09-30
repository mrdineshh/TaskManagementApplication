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
  /** Daily cap in hours (e.g. 5, or default 6 if not specified). */
  dailyHoursLimit?: number | null;
  /** Minutes already logged for today across prior sessions */
  todayLoggedMinutes?: number;
  /** Start and due dates for multi-day context */
  startDate?: string | null;
  dueDate?: string | null;
  /** Called when timer automatically pauses upon reaching the daily limit */
  onAutoPause?: () => void;
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
 * Computes live elapsed time and enforces daily work caps (e.g. 5h or 6h default)
 * with automatic pause when today's limit is hit.
 */
export function WorkSessionTimer({
  timerStartedAt,
  totalLoggedMinutes,
  size = 'full',
  estimateMinutes,
  dailyHoursLimit,
  todayLoggedMinutes = 0,
  startDate,
  dueDate,
  onAutoPause,
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
  const sessionMinutes = Math.floor(sessionSeconds / 60);
  const totalSeconds = totalLoggedMinutes * 60 + sessionSeconds;
  const totalMinutes = totalLoggedMinutes + sessionMinutes;

  // Daily budget calculations (5 hours or 6 hours default)
  const effectiveDailyHours = dailyHoursLimit && dailyHoursLimit > 0 ? dailyHoursLimit : 6;
  const dailyLimitMinutes = Math.round(effectiveDailyHours * 60);
  const todayActiveMinutes = todayLoggedMinutes + sessionMinutes;
  const isDailyCapReached = isRunning && todayActiveMinutes >= dailyLimitMinutes;

  // Auto-pause notification trigger when crossing the daily threshold
  useEffect(() => {
    if (isDailyCapReached) {
      onAutoPause?.();
    }
  }, [isDailyCapReached, onAutoPause]);

  // Overall estimate progress
  const hasEstimate = estimateMinutes != null && estimateMinutes > 0;
  const progressPct = hasEstimate ? Math.min(100, (totalMinutes / estimateMinutes!) * 100) : 0;
  const isNearLimit = hasEstimate && progressPct >= 80 && progressPct < 100;
  const isExceeded = hasEstimate && totalMinutes > estimateMinutes!;

  // Dynamic color based on budget state
  const timeColor = isExceeded
    ? 'text-red-600 dark:text-red-400'
    : isDailyCapReached
      ? 'text-amber-600 dark:text-amber-400'
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
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border-2 text-slate-900 dark:text-slate-100 shadow-2xs transition-colors whitespace-nowrap shrink-0 ${
          isExceeded
            ? 'border-red-600'
            : isRunning
              ? 'border-emerald-600'
              : 'border-slate-400'
        }`}
      >
        {isExceeded ? (
          <AlertTriangle className="h-3 w-3 text-red-600" />
        ) : isRunning ? (
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
        ) : (
          <Timer className="h-3 w-3 text-slate-600" />
        )}
        <span className="tabular-nums font-semibold">{formatDuration(totalSeconds, isRunning)}</span>
        {isExceeded && <span className="font-bold text-red-600">!</span>}
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {/* Estimate-exceeded warning banner */}
      {isExceeded && (
        <div className="rounded-2xl border-2 border-red-600 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm" style={{ borderLeftWidth: '6px' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white dark:bg-slate-900 border-2 border-red-600 p-2 text-red-600 shrink-0 mt-0.5 shadow-2xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                  Estimated time exceeded — timer paused
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-red-600" />
                  Extend Estimate
                </button>
              )}
              {onRequestReview && (
                <button
                  type="button"
                  onClick={onRequestReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all"
                >
                  <Send className="h-3.5 w-3.5 text-blue-600" />
                  Submit for Review
                </button>
              )}
            </div>
          </div>

          {/* Inline extend estimate form */}
          {showExtend && onExtendEstimate && (
            <form onSubmit={handleExtend} className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium shrink-0">New total estimate:</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={extendHours}
                onChange={(e) => setExtendHours(e.target.value)}
                placeholder="e.g. 8"
                className="w-24 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">hours</span>
              <button
                type="submit"
                disabled={extending || !extendHours}
                className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-900 border-2 border-red-600 hover:bg-red-50 text-slate-900 dark:text-slate-100 px-3 py-1 text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs"
              >
                {extending ? 'Saving…' : 'Save & Resume'}
              </button>
              <button
                type="button"
                onClick={() => setShowExtend(false)}
                className="text-xs text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

          {/* Daily limit reached banner */}
          {isDailyCapReached && !isExceeded && (
            <div className="rounded-2xl border-2 border-amber-500 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm mb-3" style={{ borderLeftWidth: '6px' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border-2 border-amber-500 p-2 text-amber-500 shrink-0 mt-0.5 shadow-2xs">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    Daily limit reached ({effectiveDailyHours}h) — timer automatically paused
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    You have completed <strong>{formatDuration(todayActiveMinutes * 60, false)}</strong> of work today. The timer has auto-paused to maintain your daily allocation. You can click <strong>Clock In</strong> below to log overtime work if necessary.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`neu-card p-5 sm:p-6 shadow-sm transition-all rounded-2xl ${isExceeded ? 'border-2 border-red-600' : isDailyCapReached ? 'border-2 border-amber-500' : ''}`}>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-2.5 shrink-0 bg-white dark:bg-slate-900 border-2 shadow-2xs ${
                    isExceeded
                      ? 'border-red-600 text-red-600'
                      : isDailyCapReached
                        ? 'border-amber-500 text-amber-500'
                        : isRunning
                          ? 'border-emerald-600 text-emerald-600'
                          : totalLoggedMinutes > 0
                            ? 'border-amber-500 text-amber-500'
                            : 'border-slate-400 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isExceeded ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : isDailyCapReached ? (
                    <Clock className="h-4 w-4 text-amber-500" />
                  ) : isRunning ? (
                    <Play className="h-4 w-4 fill-current text-emerald-600 animate-pulse" />
                  ) : totalLoggedMinutes > 0 ? (
                    <Pause className="h-4 w-4 fill-current text-amber-500" />
                  ) : (
                    <Timer className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Work Timer</span>
                    {isRunning && !isExceeded && !isDailyCapReached && (
                      <span className="flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-100 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                        LIVE
                      </span>
                    )}
                    {isDailyCapReached && (
                      <span className="flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-100 shadow-2xs">
                        <Clock className="h-3 w-3 text-amber-500" />
                        DAILY CAP ({effectiveDailyHours}h) REACHED
                      </span>
                    )}
                    {isExceeded && (
                      <span className="flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border-2 border-red-600 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-100 shadow-2xs">
                        OVER BUDGET
                      </span>
                    )}
                    {isNearLimit && !isExceeded && !isDailyCapReached && (
                      <span className="flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-100 shadow-2xs">
                        <Clock className="h-3 w-3 text-amber-500" />
                        NEARING LIMIT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isExceeded
                      ? 'Timer auto-paused — estimate exceeded'
                      : isDailyCapReached
                        ? `Daily limit of ${effectiveDailyHours}h reached — timer auto-paused for today`
                        : isRunning
                          ? `Work session recording (daily limit: ${effectiveDailyHours}h)`
                          : totalLoggedMinutes > 0
                            ? 'Timer paused between sessions'
                            : 'Timer starts when moved to In Progress'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${timeColor}`}>
                  {formatDuration(totalSeconds, isRunning && !isExceeded && !isDailyCapReached)}
                </span>
                {isRunning && sessionSeconds > 0 && !isExceeded && (
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    current session: +{formatDuration(sessionSeconds, true)}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums font-semibold">
                  Today: {formatDuration(todayActiveMinutes * 60, false)} / {effectiveDailyHours}h daily
                </div>
                {hasEstimate && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums font-medium">
                    of {formatDuration(estimateMinutes! * 60, false)} total estimated
                  </div>
                )}
              </div>
            </div>

            {/* Daily progress bar vs daily cap */}
            <div className="my-3">
              <div className="flex justify-between mb-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                <span>Today's Work Budget ({effectiveDailyHours}h limit)</span>
                <span className={todayActiveMinutes >= dailyLimitMinutes ? 'text-amber-600 font-bold' : ''}>
                  {Math.round(Math.min(100, (todayActiveMinutes / dailyLimitMinutes) * 100))}% ({formatDuration(todayActiveMinutes * 60, false)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    todayActiveMinutes >= dailyLimitMinutes
                      ? 'bg-amber-500'
                      : isRunning
                        ? 'bg-emerald-500'
                        : 'bg-slate-400'
                  }`}
                  style={{ width: `${Math.min(100, (todayActiveMinutes / dailyLimitMinutes) * 100)}%` }}
                />
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
                <Pause className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Work paused ({formatDuration(totalLoggedMinutes * 60, false)} banked)</span>
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
