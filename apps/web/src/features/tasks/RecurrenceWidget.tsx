import { useEffect, useState } from 'react';
import { RefreshCw, Pencil, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client/client';
import { useQueryClient } from '@tanstack/react-query';

const PRESET_RULES = [
  { label: 'Daily',     rule: 'FREQ=DAILY' },
  { label: 'Weekdays',  rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly',    rule: 'FREQ=WEEKLY' },
  { label: 'Bi-weekly', rule: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Monthly',   rule: 'FREQ=MONTHLY' },
  { label: 'Quarterly', rule: 'FREQ=MONTHLY;INTERVAL=3' },
  { label: 'Custom…',   rule: '' },
];

function friendlyLabel(rule: string | null): string {
  if (!rule) return 'Custom';
  const match = PRESET_RULES.find((p) => p.rule === rule && p.rule !== '');
  return match ? match.label : `Custom (${rule})`;
}

interface RecurrenceWidgetProps {
  taskId: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  canEdit?: boolean;
}

/**
 * Recurrence builder widget (plan §1.6).
 * After saving, collapses to a "Recurring: <label> · Edit" summary row
 * so the user gets immediate confirmation the save worked.
 * Uses useEffect to sync local state whenever the parent re-fetches task data.
 */
export function RecurrenceWidget({ taskId, isRecurring, recurrenceRule, canEdit = true }: RecurrenceWidgetProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localRecurring, setLocalRecurring] = useState(isRecurring);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (!isRecurring || !recurrenceRule) return '';
    const match = PRESET_RULES.find((p) => p.rule === recurrenceRule && p.rule !== '');
    return match ? match.rule : '__custom__';
  });
  const [customRule, setCustomRule] = useState(
    recurrenceRule && !PRESET_RULES.some((p) => p.rule === recurrenceRule) ? recurrenceRule : '',
  );

  // editing = show full form; false = show collapsed summary.
  // If already recurring on mount, start collapsed (summary view).
  const [editing, setEditing] = useState(!isRecurring);

  // Sync from parent props whenever the query re-fetches (e.g. after save invalidation).
  useEffect(() => {
    setLocalRecurring(isRecurring);
    if (isRecurring && recurrenceRule) {
      const match = PRESET_RULES.find((p) => p.rule === recurrenceRule && p.rule !== '');
      setSelectedPreset(match ? match.rule : '__custom__');
      setCustomRule(match ? '' : (recurrenceRule ?? ''));
      setEditing(false); // collapse after parent re-fetches updated data
    } else {
      setSelectedPreset('');
      setCustomRule('');
      setEditing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecurring, recurrenceRule]);

  const effectiveRule = selectedPreset === '__custom__' ? customRule : selectedPreset;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.tasks.update(taskId, {
        is_recurring: localRecurring,
        recurrence_rule: localRecurring ? effectiveRule || null : null,
      });
      setEditing(false); // immediately collapse to summary to confirm success
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recurrence settings');
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.tasks.update(taskId, { is_recurring: false, recurrence_rule: null });
      setLocalRecurring(false);
      setSelectedPreset('');
      setCustomRule('');
      setEditing(true);
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task');
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit && !localRecurring) {
    return (
      <div className="neu-card">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Recurrence</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">Not recurring.</p>
      </div>
    );
  }

  return (
    <div className="neu-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recurrence</h2>
        {canEdit && localRecurring && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={disable}
              disabled={saving}
              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}
        {canEdit && localRecurring && editing && (
          <button
            onClick={disable}
            disabled={saving}
            className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            Remove recurrence
          </button>
        )}
      </div>

      {/* Saved / collapsed summary */}
      {localRecurring && !editing ? (
        <div className="flex items-center gap-2 rounded-md bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 px-3 py-2">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            Recurring · {friendlyLabel(recurrenceRule)}
          </span>
          {recurrenceRule && (
            <span className="ml-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
              RRULE:{recurrenceRule}
            </span>
          )}
        </div>
      ) : !localRecurring ? (
        /* Not yet recurring — offer to enable */
        <button
          onClick={() => { setLocalRecurring(true); setEditing(true); }}
          className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-400 dark:hover:border-brand-600 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Make this task recurring
        </button>
      ) : (
        /* Edit / setup form */
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A new copy of this task will be created each time it's completed, following the schedule below.
          </p>

          {/* Preset picker */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PRESET_RULES.map((p) => {
              const isCustom = p.rule === '';
              const value = isCustom ? '__custom__' : p.rule;
              const isActive = selectedPreset === value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedPreset(value)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom RRULE input */}
          {selectedPreset === '__custom__' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                iCal RRULE string
              </label>
              <input
                type="text"
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Standard iCal RRULE without the "RRULE:" prefix.
              </p>
            </div>
          )}

          {/* Preview */}
          {effectiveRule && (
            <p className="rounded-md bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              RRULE:{effectiveRule}
            </p>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || (localRecurring && !effectiveRule)}
              className="btn-primary transition-colors"
            >
              {saving ? 'Saving…' : 'Save recurrence'}
            </button>
            {isRecurring && (
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
