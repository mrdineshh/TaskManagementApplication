import { useState } from 'react';
import { useAddTimeLog, useTimeLogs, useUpdateTimeLog } from './hooks';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Optional time tracking, manual entry (docs/05-FEATURES.md §2.1 — optional everywhere per
 * 10-OPEN-DECISIONS.md B1). Hours + date, not minutes/timestamps — deliberately simple per
 * docs/10-OPEN-DECISIONS.md §H3 ("time stamp will be very granular and it will be tough").
 * Edits are self-service for 30 minutes after an entry is created, Admin can override after
 * that — enforced server-side; this widget just surfaces whatever the API says.
 */
export function TimeLogWidget({ taskId }: { taskId: string }) {
  const { data: logs } = useTimeLogs(taskId);
  const addTimeLog = useAddTimeLog(taskId);
  const updateTimeLog = useUpdateTimeLog(taskId);
  const [hours, setHours] = useState('1');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');

  const totalMinutes = logs?.reduce((sum, l) => sum + l.minutes, 0) ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!h || h <= 0) return;
    await addTimeLog.mutateAsync({ minutes: Math.round(h * 60), note: note || undefined, loggedAt: date });
    setNote('');
  }

  async function handleSaveEdit(logId: string) {
    const h = Number(editHours);
    if (!h || h <= 0) return;
    try {
      await updateTimeLog.mutateAsync({ logId, data: { minutes: Math.round(h * 60) } });
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update this entry');
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Time logged</h2>
        <span className="text-sm text-slate-500">{(totalMinutes / 60).toFixed(1)}h total</span>
      </div>
      <ul className="mb-3 space-y-1">
        {logs?.map((l) => (
          <li key={l.id} className="flex items-center justify-between text-sm text-slate-600">
            {editingId === l.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button onClick={() => handleSaveEdit(l.id)} className="text-xs text-brand-700 hover:underline">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:underline">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span>
                  {l.note || '(no note)'} — {new Date(l.logged_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-2 text-slate-400">
                  {(l.minutes / 60).toFixed(1)}h
                  <button
                    onClick={() => {
                      setEditingId(l.id);
                      setEditHours((l.minutes / 60).toString());
                    }}
                    className="text-xs text-slate-400 hover:text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
        {logs?.length === 0 && <li className="text-sm text-slate-400">No time logged yet.</li>}
      </ul>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <span className="self-center text-xs text-slate-400">hrs</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={addTimeLog.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Log
        </button>
      </form>
    </div>
  );
}
