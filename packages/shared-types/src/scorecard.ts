import { z } from 'zod';
import type { ISODateString } from './common';

/**
 * Employee scorecard (docs/10-OPEN-DECISIONS.md §J) — six confirmed sub-metrics, each
 * normalized to a 0-100 sub-score so they can be meaningfully blended into one overall
 * score for the leaderboard while still being shown separately for transparency. Computed
 * live for an arbitrary [start, end] range — NOT served from ReportAggregateCache, which is
 * a fixed-daily-snapshot system unsuited to custom ranges.
 */
export const scorecardMetricKeys = [
  'on_time_rate',
  'estimate_accuracy',
  'volume',
  'overdue',
  'over_budget',
  'rework',
] as const;
export type ScorecardMetricKey = (typeof scorecardMetricKeys)[number];

/**
 * Admin-tunable weights (must sum to 1) — defaults chosen as a reasonable starting point,
 * not hardcoded logic: quality/reliability (on-time, estimate accuracy) weighted slightly
 * above throughput (volume), overdue/over-budget/rework treated as smaller penalty signals
 * since they overlap in spirit with on-time/estimate-accuracy but catch distinct failure
 * modes (a task can be on-time yet over-budget, or accurately estimated yet reworked).
 */
export const DEFAULT_SCORECARD_WEIGHTS: Record<ScorecardMetricKey, number> = {
  on_time_rate: 0.25,
  estimate_accuracy: 0.2,
  volume: 0.15,
  overdue: 0.15,
  over_budget: 0.15,
  rework: 0.1,
};

export const scorecardWeightsSchema = z
  .object({
    on_time_rate: z.number().min(0).max(1),
    estimate_accuracy: z.number().min(0).max(1),
    volume: z.number().min(0).max(1),
    overdue: z.number().min(0).max(1),
    over_budget: z.number().min(0).max(1),
    rework: z.number().min(0).max(1),
  })
  .refine((w) => Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 0.001, {
    message: 'Weights must sum to 1',
  });
export type ScorecardWeights = z.infer<typeof scorecardWeightsSchema>;

export const updateScorecardConfigSchema = z.object({
  weights: scorecardWeightsSchema,
});
export type UpdateScorecardConfigInput = z.infer<typeof updateScorecardConfigSchema>;

export interface ScorecardConfig {
  id: string;
  weights: ScorecardWeights;
  updated_at: ISODateString;
}

export interface ScorecardSubScores {
  on_time_rate: number;
  estimate_accuracy: number;
  volume: number;
  overdue: number;
  over_budget: number;
  rework: number;
}

export interface Scorecard {
  user_id: string;
  department_id: string;
  range_start: ISODateString;
  range_end: ISODateString;
  overall_score: number;
  sub_scores: ScorecardSubScores;
  /** Raw counts behind the sub-scores, for context alongside the normalized numbers. */
  raw: {
    completed_count: number;
    on_time_count: number;
    overdue_count: number;
    over_budget_count: number;
    reworked_count: number;
    avg_estimate_error_pct: number | null;
  };
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  overall_score: number;
  rank: number;
}

export const scorecardRangeQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export type ScorecardRangeQuery = z.infer<typeof scorecardRangeQuerySchema>;
