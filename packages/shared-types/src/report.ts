import { z } from 'zod';
import type { ISODateString } from './common';

/**
 * Registered metric definitions (docs/05-FEATURES.md §3.2) — the starter set, extensible.
 * Each has a real backing query in the API; which metrics appear in which report is
 * entirely user-configured via SavedReport.config, per the configurability principle.
 */
export const reportMetricKeys = [
  'task_counts_by_status',
  'task_counts_by_department',
  'task_counts_by_assignee',
  'task_counts_by_priority',
  'overdue_count',
  'overdue_rate',
  // Independent from overdue_* — over budget means logged hours exceeded the estimate,
  // regardless of due date (docs/10-OPEN-DECISIONS.md §I1: tracked as two separate metrics,
  // never merged into one "at risk" flag).
  'over_budget_count',
  'over_budget_rate',
  'avg_time_to_completion_hours',
  'sla_compliance_rate',
  'workload_distribution',
  'time_tracked_minutes',
  'completion_throughput',
] as const;
export type ReportMetricKey = (typeof reportMetricKeys)[number];

export interface ReportMetricDefinition {
  key: ReportMetricKey;
  label: string;
  description: string;
  /** Whether this metric can be broken down by the given dimension. */
  supported_dimensions: ReportDimension[];
  /** v1.1-data-dependent metrics (SLA compliance, time tracked) per 05-FEATURES.md §3.2. */
  requires_v11_data: boolean;
}

export const reportDimensions = ['department', 'assignee', 'status', 'priority', 'time_period'] as const;
export type ReportDimension = (typeof reportDimensions)[number];

export const reportChartTypes = ['bar', 'line', 'pie', 'table'] as const;
export type ReportChartType = (typeof reportChartTypes)[number];

// Matches apps/web/src/components/DateRangePicker.tsx's DATE_RANGE_PRESETS (docs/10-OPEN-
// DECISIONS.md §M9) — the same preset set is used for every date-range filter in the app, not
// just reports. Stored as a preset (not resolved start/end) so a saved/scheduled report's "this
// month" always means the month it *runs* in, not the month it was configured.
export const reportDatePresets = [
  'today',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year_calendar',
  'this_year_fiscal',
] as const;
export const reportDateRangeSchema = z.union([
  z.object({ start: z.string().datetime(), end: z.string().datetime() }),
  z.object({ preset: z.enum(reportDatePresets) }),
]);
export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;

export const reportConfigSchema = z.object({
  metrics: z.array(z.enum(reportMetricKeys)).min(1),
  dimensions: z.array(z.enum(reportDimensions)).default([]),
  date_range: reportDateRangeSchema,
  chart_type: z.enum(reportChartTypes),
  filters: z
    .object({
      department_id: z.string().uuid().optional(),
      status_id: z.string().uuid().optional(),
      priority_id: z.string().uuid().optional(),
    })
    .default({}),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;

export const reportVisibilities = ['private', 'shared_roles', 'shared_org'] as const;
export type ReportVisibility = (typeof reportVisibilities)[number];

export interface SavedReport {
  id: string;
  name: string;
  created_by_id: string;
  config: ReportConfig;
  visibility: ReportVisibility;
  shared_with_role_ids: string[];
  is_template: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  config: reportConfigSchema,
  visibility: z.enum(reportVisibilities).default('private'),
  shared_with_role_ids: z.array(z.string().uuid()).default([]),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const updateReportSchema = createReportSchema.partial();
export type UpdateReportInput = z.infer<typeof updateReportSchema>;

export interface ReportRunResult {
  metric: ReportMetricKey;
  /** Each row is one point/bar/slice — { dimension_label, value }, or a single-row table for scalar metrics. */
  rows: { dimension_label: string; dimension_value: string | null; value: number }[];
}

export const reportFrequencies = ['daily', 'weekly', 'monthly'] as const;
export type ReportFrequency = (typeof reportFrequencies)[number];

export const reportExportFormats = ['csv', 'xlsx', 'pdf'] as const;
export type ReportExportFormat = (typeof reportExportFormats)[number];

export interface ReportSchedule {
  id: string;
  saved_report_id: string;
  frequency: ReportFrequency;
  send_at: string;
  day_of_week: number | null;
  day_of_month: number | null;
  recipient_user_ids: string[];
  recipient_role_ids: string[];
  export_format: ReportExportFormat;
  is_active: boolean;
  last_run_at: ISODateString | null;
}

export const createReportScheduleSchema = z.object({
  frequency: z.enum(reportFrequencies),
  send_at: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'send_at must be HH:MM'),
  day_of_week: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
  recipient_user_ids: z.array(z.string().uuid()).default([]),
  recipient_role_ids: z.array(z.string().uuid()).default([]),
  export_format: z.enum(reportExportFormats),
});
export type CreateReportScheduleInput = z.infer<typeof createReportScheduleSchema>;

/** Default: aggregate cache refresh interval per 05-FEATURES.md §3.6. */
export const DEFAULT_AGGREGATE_REFRESH_MINUTES = 15;
