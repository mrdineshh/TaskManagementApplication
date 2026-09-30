import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-600 bg-white dark:bg-slate-900 text-emerald-600 shadow-neu-sm">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Effort Estimate</h2>
              {effectiveVal !== null && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Mandatory Scheduled
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Required time allocation &amp; budget</p>
          </div>
        </div>
        {canEdit && effectiveVal !== null && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all"
          >
            Edit
          </button>
        )}
      </div>

      {effectiveVal === null && !editing && (
        canEdit ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No estimate recorded yet — <strong className="text-amber-600 dark:text-amber-400">required before work can start</strong>.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all"
            >
              + Add Effort Estimate
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No estimate recorded yet.</p>
        )
      )}

      {effectiveVal !== null && !editing && (
        <div className="space-y-1">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {effectiveVal} {effectiveUnit}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {effectiveUnit === 'hours'
              ? `Daily work timer runs for up to ${effectiveVal}h daily and automatically pauses.`
              : `Total span of ${effectiveVal} days. Auto-pauses daily after 6 active hours.`}
          </p>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter expected hours or days. For multi-day tasks, specifying hours sets your daily timer limit (e.g. 5h/day).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 neu-input"
              placeholder="0"
              required
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
              className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow-neu-sm transition-all disabled:opacity-50"
            >
              {submitEstimate.isPending ? 'Saving…' : 'Submit'}
            </button>
            {effectiveVal !== null && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
