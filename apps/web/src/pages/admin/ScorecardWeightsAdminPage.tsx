import { useEffect, useState } from 'react';
import { useScorecardConfig, useUpdateScorecardConfig } from '../../features/tasks/hooks';
import type { ScorecardWeights } from '@taskapp/shared-types';

const LABELS: Record<keyof ScorecardWeights, string> = {
  on_time_rate: 'On-time completion rate',
  estimate_accuracy: 'Estimate accuracy',
  volume: 'Volume (completed tasks)',
  overdue: 'Overdue avoidance',
  over_budget: 'Over-budget avoidance',
  rework: 'Rework avoidance',
};

/**
 * Admin-tunable scorecard weighting (docs/10-OPEN-DECISIONS.md §J) — the six sub-metric
 * weights blended into the one overall leaderboard score. Defaults were chosen by us during
 * scoping as a reasonable starting point, explicitly NOT hardcoded: the user asked for
 * "collective knowledge... best... and let the admin change and reconfigure it later stage."
 */
export function ScorecardWeightsAdminPage() {
  const { data: config, isLoading } = useScorecardConfig();
  const updateConfig = useUpdateScorecardConfig();
  const [weights, setWeights] = useState<ScorecardWeights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setWeights(config.weights);
  }, [config]);

  if (isLoading || !weights) return <p className="text-slate-400">Loading…</p>;

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  function handleChange(key: keyof ScorecardWeights, value: string) {
    const num = Number(value);
    setWeights((prev) => (prev ? { ...prev, [key]: Number.isFinite(num) ? num : 0 } : prev));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!weights) return;
    if (Math.abs(total - 1) > 0.001) {
      setError('Weights must sum to 1.0 (currently ' + total.toFixed(2) + ')');
      return;
    }
    await updateConfig.mutateAsync(weights);
    setSaved(true);
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-slate-500">
        Each employee's overall leaderboard score blends these six sub-metrics. Weights must sum to 1.0.
      </p>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {(Object.keys(weights) as (keyof ScorecardWeights)[]).map((key) => (
          <label key={key} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-700">{LABELS[key]}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={weights[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right"
            />
          </label>
        ))}
        <div className={`flex justify-between border-t border-slate-100 pt-3 text-sm font-medium ${Math.abs(total - 1) > 0.001 ? 'text-red-600' : 'text-slate-700'}`}>
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      <button
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Save weights
      </button>
    </div>
  );
}
