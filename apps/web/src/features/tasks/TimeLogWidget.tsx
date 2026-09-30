import { useState } from 'react';
import { ClipboardList, Clock, PenLine } from 'lucide-react';
import { toast } from '../../lib/toast/toast-store';
import { useAddTimeLog, useTimeLogs, useUpdateTimeLog } from './hooks';
import { fmtDate } from '../../lib/utils/dates';
import { NeuDatePicker } from '../../components/NeuDatePicker';

const today = () => new Date().toISOString().slice(0, 10);

function fmtMinutes(minutes: number) {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Unified Time Tracking Log.
 *
 * PURPOSE — answers "how much time did this task actually take?"
 *
 * There are TWO sources of tracked time on a task:
 *   1. **Live sessions** (Clock In / Clock Out): automatically banked when the
 *      work-session timer runs. These appear in the WorkSessionTimer widget above.
 *   2. **Manual log entries** (this widget): for time worked offline, in meetings,
 *      or on days you forgot to clock in. E.g. "I spent 2 hours reviewing docs
 *      yesterday but never clicked Clock In."
 *
 * Both sources are combined in the TOTAL shown here, giving a complete picture.
 */
export function TimeLogWidget({
  taskId,
  sessionMinutes = 0,
}: {
  taskId: string;
  /** Minutes banked from live clock-in/out sessions (passed from TaskDetailPage). */
  sessionMinutes?: number;
}) {
  const { data: logs } = useTimeLogs(taskId);
  const addTimeLog = useAddTimeLog(taskId);
  const updateTimeLog = useUpdateTimeLog(taskId);
  const [hours, setHours] = useState('1');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');

  const manualMinutes = logs?.reduce((sum, l) => sum + l.minutes, 0) ?? 0;
  const totalMinutes = sessionMinutes + manualMinutes;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!h || h <= 0) return;
    await addTimeLog.mutateAsync({ minutes: Math.round(h * 60), note: note || undefined, loggedAt: date });
    setNote('');
    setHours('1');
  }

  async function handleSaveEdit(logId: string) {
    const h = Number(editHours);
    if (!h || h <= 0) return;
    try {
      await updateTimeLog.mutateAsync({ logId, data: { minutes: Math.round(h * 60) } });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update this entry');
    }
  }

  return (
    <div className="neu-card">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-purple-600 bg-white dark:bg-slate-900 text-purple-600 shadow-neu-sm">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Time Log</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Manual entries + live sessions</p>
          </div>
        </div>
        {/* Grand total */}
        <div className="text-right shrink-0">
          <span className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">
            {fmtMinutes(totalMinutes)}
          </span>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">total tracked</p>
        </div>
      </div>

      {/* Summary row: live vs manual */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-white dark:bg-slate-900 border-2 border-emerald-600 shadow-neu-sm px-3 py-2 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Live sessions</p>
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMinutes(sessionMinutes)}</p>
          </div>
        </div>
        <div className="rounded-md bg-white dark:bg-slate-900 border-2 border-purple-600 shadow-neu-sm px-3 py-2 flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Manual entries</p>
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMinutes(manualMinutes)}</p>
          </div>
        </div>
      </div>

      {/* Manual entries list */}
      {logs && logs.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Manual entries</p>
          <ul className="space-y-1.5">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-neu-sm">
                {editingId === l.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-semibold"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">hrs</span>
                    <button
                      onClick={() => handleSaveEdit(l.id)}
                      className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 shadow-neu-sm transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex items-center gap-2 min-w-0">
                      <PenLine className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">{l.note || '(no note)'}</span>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {fmtDate(l.logged_at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMinutes(l.minutes)}</span>
                      <button
                        onClick={() => { setEditingId(l.id); setEditHours((l.minutes / 60).toString()); }}
                        className="inline-flex items-center gap-1 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all"
                      >
                        Edit
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add manual entry form */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Log time manually</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
          Use this for time you worked without using Clock In — e.g. offline work, meetings, or forgotten sessions.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            min={0.25}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          />
          <span className="self-center text-xs text-slate-500 dark:text-slate-400 font-medium">hrs</span>
          <NeuDatePicker
            value={date}
            onChange={setDate}
            placeholder="Select date"
            compact
            style={{ width: '135px' }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you work on? (optional)"
            className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm min-w-32"
          />
          <button
            type="submit"
            disabled={addTimeLog.isPending}
            className="inline-flex items-center gap-1 rounded-md border-2 border-purple-600 bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 shadow-neu-sm transition-all disabled:opacity-50"
          >
            {addTimeLog.isPending ? 'Adding…' : 'Log Time'}
          </button>
        </form>
      </div>
    </div>
  );
}
