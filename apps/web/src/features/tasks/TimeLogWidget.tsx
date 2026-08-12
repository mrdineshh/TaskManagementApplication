import { useState } from 'react';
import { useAddTimeLog, useTimeLogs } from './hooks';

/** Optional time tracking, manual entry (docs/05-FEATURES.md §2.1 — optional everywhere per 10-OPEN-DECISIONS.md B1). */
export function TimeLogWidget({ taskId }: { taskId: string }) {
  const { data: logs } = useTimeLogs(taskId);
  const addTimeLog = useAddTimeLog(taskId);
  const [minutes, setMinutes] = useState('30');
  const [note, setNote] = useState('');

  const totalMinutes = logs?.reduce((sum, l) => sum + l.minutes, 0) ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(minutes);
    if (!m || m < 1) return;
    await addTimeLog.mutateAsync({ minutes: m, note: note || undefined });
    setNote('');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Time logged</h2>
        <span className="text-sm text-slate-500">
          {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
        </span>
      </div>
      <ul className="mb-3 space-y-1">
        {logs?.map((l) => (
          <li key={l.id} className="flex justify-between text-sm text-slate-600">
            <span>{l.note || '(no note)'}</span>
            <span className="text-slate-400">{l.minutes}m</span>
          </li>
        ))}
        {logs?.length === 0 && <li className="text-sm text-slate-400">No time logged yet.</li>}
      </ul>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
