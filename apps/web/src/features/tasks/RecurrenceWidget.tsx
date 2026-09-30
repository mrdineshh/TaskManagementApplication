import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Pencil, X, Sparkles, Check, Trash2, Repeat } from 'lucide-react';
import { apiClient } from '../../lib/api-client/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../lib/toast/toast-store';

const ALL_PRESET_RULES = [
  { label: 'Daily',     rule: 'FREQ=DAILY', minDays: 1, maxDays: 1 },
  { label: 'Weekdays',  rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', minDays: 1, maxDays: 1 },
  { label: 'Weekly',    rule: 'FREQ=WEEKLY', minDays: 1, maxDays: 5 },
  { label: 'Bi-weekly', rule: 'FREQ=WEEKLY;INTERVAL=2', minDays: 1, maxDays: 365 },
  { label: 'Monthly',   rule: 'FREQ=MONTHLY', minDays: 1, maxDays: 365 },
  { label: 'Quarterly', rule: 'FREQ=MONTHLY;INTERVAL=3', minDays: 1, maxDays: 365 },
  { label: 'Custom…',   rule: '', minDays: 1, maxDays: 365 },
];

function friendlyLabel(rule: string | null): string {
  if (!rule) return 'Custom';
  const match = ALL_PRESET_RULES.find((p) => p.rule === rule && p.rule !== '');
  return match ? match.label : `Custom (${rule})`;
}

interface RecurrenceWidgetProps {
  taskId: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  recurrenceIndex?: number | null;
  recurrenceParentId?: string | null;
  canEdit?: boolean;
}

/**
 * Dynamic recurrence widget with duration-aware presets and iteration tracking.
 */
export function RecurrenceWidget({
  taskId,
  isRecurring,
  recurrenceRule,
  startDate,
  dueDate,
  recurrenceIndex,
  recurrenceParentId,
  canEdit = true,
}: RecurrenceWidgetProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localRecurring, setLocalRecurring] = useState(isRecurring);

  // Calculate task duration in days to filter impossible recurrence frequencies
  const durationDays = useMemo(() => {
    if (!startDate || !dueDate) return 1;
    const s = new Date(startDate).getTime();
    const d = new Date(dueDate).getTime();
    const diff = Math.round((d - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, isNaN(diff) ? 1 : diff);
  }, [startDate, dueDate]);

  // Dynamically filter presets based on task duration
  const availablePresets = useMemo(() => {
    return ALL_PRESET_RULES.filter((p) => durationDays >= p.minDays && durationDays <= p.maxDays);
  }, [durationDays]);

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (!isRecurring || !recurrenceRule) return '';
    const match = ALL_PRESET_RULES.find((p) => p.rule === recurrenceRule && p.rule !== '');
    return match ? match.rule : '__custom__';
  });
  const [customRule, setCustomRule] = useState(
    recurrenceRule && !ALL_PRESET_RULES.some((p) => p.rule === recurrenceRule) ? recurrenceRule : '',
  );

  const [editing, setEditing] = useState(!isRecurring);

  useEffect(() => {
    setLocalRecurring(isRecurring);
    if (isRecurring && recurrenceRule) {
      const match = ALL_PRESET_RULES.find((p) => p.rule === recurrenceRule && p.rule !== '');
      setSelectedPreset(match ? match.rule : '__custom__');
      setCustomRule(match ? '' : (recurrenceRule ?? ''));
      setEditing(false);
    } else {
      setSelectedPreset('');
      setCustomRule('');
      setEditing(true);
    }
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
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Recurrence schedule saved');
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
      toast.info('Recurrence removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task');
    } finally {
      setSaving(false);
    }
  }

  async function handleSpawnOccurrence() {
    setSpawning(true);
    try {
      const result = await apiClient.tasks.spawnRecurrence(taskId);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Spawned recurrence #${result.recurrence_index ?? 2}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not spawn next occurrence');
    } finally {
      setSpawning(false);
    }
  }

  const iterationNumber = recurrenceIndex ?? (recurrenceParentId ? 2 : 1);

  if (!canEdit && !localRecurring) {
    return (
      <div className="neu-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 shadow-neu-sm">
            <Repeat className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recurrence</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Not recurring</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-purple-600 bg-white dark:bg-slate-900 text-purple-600 shadow-neu-sm">
            <Repeat className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recurrence</h2>
              {(localRecurring || recurrenceParentId || (recurrenceIndex && recurrenceIndex > 1)) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                  Iteration #{iterationNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Automatic recurring task schedule</p>
          </div>
        </div>

        {canEdit && localRecurring && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all"
            >
              <Pencil className="h-3 w-3 text-blue-600" />
              Edit
            </button>
            <button
              onClick={disable}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md border-2 border-red-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 shadow-neu-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3 text-red-600" />
              Remove
            </button>
          </div>
        )}
        {canEdit && localRecurring && editing && (
          <button
            onClick={disable}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border-2 border-red-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 shadow-neu-sm transition-all disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3 text-red-600" />
            Remove recurrence
          </button>
        )}
      </div>

      {/* Saved / collapsed summary */}
      {localRecurring && !editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md bg-white dark:bg-slate-900 border-2 border-purple-600 px-3 py-2.5 shadow-neu-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recurring · {friendlyLabel(recurrenceRule)}
              </span>
              {recurrenceRule && (
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {recurrenceRule}
                </span>
              )}
            </div>
            {durationDays > 1 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {durationDays}-day cycle
              </span>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Next occurrence is created automatically when this task is completed.
              </p>
              <button
                type="button"
                onClick={handleSpawnOccurrence}
                disabled={spawning}
                className="inline-flex items-center gap-1.5 rounded-md border-2 border-purple-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 shadow-neu-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                {spawning ? 'Spawning…' : 'Spawn Next Occurrence Now'}
              </button>
            </div>
          )}
        </div>
      ) : !localRecurring ? (
        /* Not yet recurring — offer to enable */
        <button
          onClick={() => { setLocalRecurring(true); setEditing(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:border-purple-600 hover:text-purple-700 dark:hover:text-purple-300 transition-colors shadow-neu-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Make this task recurring
        </button>
      ) : (
        /* Edit / setup form */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Task span: <strong className="text-slate-900 dark:text-slate-100">{durationDays} day{durationDays !== 1 ? 's' : ''}</strong>. Select recurrence interval:
            </p>
            {durationDays > 1 && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                (Frequencies shorter than task span hidden)
              </span>
            )}
          </div>

          {/* Dynamic Preset picker */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {availablePresets.map((p) => {
              const isCustom = p.rule === '';
              const value = isCustom ? '__custom__' : p.rule;
              const isActive = selectedPreset === value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedPreset(value)}
                  className={`rounded-md border-2 px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 shadow-neu-sm'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-purple-400'
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                iCal RRULE string
              </label>
              <input
                type="text"
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Standard iCal RRULE without the "RRULE:" prefix.
              </p>
            </div>
          )}

          {/* Preview */}
          {effectiveRule && (
            <p className="rounded-md bg-slate-100 dark:bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              RRULE:{effectiveRule}
            </p>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || (localRecurring && !effectiveRule)}
              className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow-neu-sm transition-all disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              {saving ? 'Saving…' : 'Save recurrence'}
            </button>
            {isRecurring && (
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all"
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
