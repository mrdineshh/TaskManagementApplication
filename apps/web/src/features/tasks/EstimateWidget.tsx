import { useEffect, useState } from 'react';
import { toast } from '../../lib/toast/toast-store';
import { useSubmitEstimate } from './hooks';
import { NeuSelect } from '../../components/NeuSelect';

/**
 * Effort estimation (docs/10-OPEN-DECISIONS.md §H2) — set by the assignee, mandatory before a
 * task can move into the "In Progress" status, self-service editable for 30 minutes after
 * submission and Admin-overridable after that.
 */
export function EstimateWidget({
  taskId,
  estimateValue = null,
  estimateUnit = 'hours',
  canEdit = true,
}: {
  taskId: string;
  estimateValue?: number | null;
  estimateUnit?: string | null;
  canEdit?: boolean;
}) {
  const submitEstimate = useSubmitEstimate(taskId);
  const estimateVal = estimateValue ?? null;
  const estimateUnitVal = (estimateUnit as 'hours' | 'days') ?? 'hours';
  const [editing, setEditing] = useState(estimateValue === null || estimateValue === undefined);
  const [value, setValue] = useState(estimateValue ? String(estimateValue) : '');
  const [unit, setUnit] = useState<'hours' | 'days'>(estimateUnitVal);
  // Optimistic state to ensure immediate smooth display upon submission without any flashing delay
  const [submitted, setSubmitted] = useState<{ value: number; unit: 'hours' | 'days' } | null>(null);

  useEffect(() => {
    if (estimateValue !== null && estimateValue !== undefined) {
      setSubmitted(null);
      setValue(String(estimateValue));
      setEditing(false);
    }
  }, [estimateValue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(value);
    if (!v || v <= 0) return;
    try {
      setSubmitted({ value: v, unit });
      setEditing(false);
      await submitEstimate.mutateAsync({ value: v, unit });
    } catch (err) {
      setSubmitted(null);
      setEditing(true);
      toast.error(err instanceof Error ? err.message : 'Could not submit this estimate');
    }
  }

  const effectiveVal = submitted ? submitted.value : estimateVal;
  const effectiveUnit = submitted ? submitted.unit : estimateUnitVal;

  return (
    <div className="neu-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Effort estimate</h2>
        {canEdit && effectiveVal !== null && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
            Edit
          </button>
        )}
      </div>

      {effectiveVal === null && !editing && (
        canEdit ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No estimate recorded yet — required before moving to "In Progress".{' '}
            <button onClick={() => setEditing(true)} className="text-brand-700 dark:text-brand-300 font-medium hover:underline">
              Add estimate
            </button>
          </p>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No estimate recorded yet.</p>
        )
      )}

      {effectiveVal !== null && !editing && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {effectiveVal} {effectiveUnit}
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
            className="w-24 neu-input"
            placeholder="0"
          />
          <NeuSelect
            value={unit}
            onChange={(v) => setUnit(v as 'hours' | 'days')}
            options={[
              { value: 'hours', label: 'hours' },
              { value: 'days', label: 'days' },
            ]}
            compact
            style={{ minWidth: '85px' }}
          />
          <button
            type="submit"
            disabled={submitEstimate.isPending}
            className="btn-primary"
          >
            {submitEstimate.isPending ? 'Saving…' : 'Submit'}
          </button>
          {effectiveVal !== null && (
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 dark:text-slate-500 hover:underline">
              Cancel
            </button>
          )}
        </form>
      )}
    </div>
  );
}
