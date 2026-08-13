import { useState } from 'react';
import { useSubmitEstimate } from './hooks';

/**
 * Effort estimation (docs/10-OPEN-DECISIONS.md §H2) — set by the assignee, mandatory before a
 * task can move into the "In Progress" status, self-service editable for 30 minutes after
 * submission and Admin-overridable after that (both enforced server-side; this widget just
 * surfaces whatever the API says rather than trying to duplicate that logic client-side).
 */
export function EstimateWidget({ taskId, task }: { taskId: string; task: { estimate_value: number | null; estimate_unit: 'hours' | 'days' | null } }) {
  const submitEstimate = useSubmitEstimate(taskId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.estimate_value?.toString() ?? '');
  const [unit, setUnit] = useState<'hours' | 'days'>(task.estimate_unit ?? 'hours');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(value);
    if (!v || v <= 0) return;
    try {
      await submitEstimate.mutateAsync({ value: v, unit });
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not submit this estimate');
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Effort estimate</h2>
        {task.estimate_value !== null && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-700 hover:underline">
            Edit
          </button>
        )}
      </div>

      {task.estimate_value === null && !editing && (
        <p className="text-sm text-amber-700">
          No estimate yet — required before this task can move to "In Progress".{' '}
          <button onClick={() => setEditing(true)} className="text-brand-700 hover:underline">
            Add one
          </button>
        </p>
      )}

      {task.estimate_value !== null && !editing && (
        <p className="text-sm text-slate-700">
          {task.estimate_value} {task.estimate_unit}
        </p>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0.25}
            step={0.25}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'hours' | 'days')}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          <button
            type="submit"
            disabled={submitEstimate.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Submit
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
