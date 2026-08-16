import type { ReportMetricKey } from '@taskapp/shared-types';

const USER_KEYED_METRICS = new Set<ReportMetricKey>(['task_counts_by_assignee', 'workload_distribution', 'time_tracked_minutes']);

/**
 * Maps a report row back to a filtered task list (docs/10-OPEN-DECISIONS.md §M6) — mirrors
 * apps/api/src/reports/reports.service.ts's labelFor(), which is the one place that already
 * knows what a metric's dimension_value actually is (a status/department/priority/user id, or
 * the literal string "all"/"unassigned" for metrics with no real per-row entity). Returns null
 * rather than a link that would land on a mismatched or empty task list — several metrics
 * (rates, averages, throughput) have no honest task-list equivalent at all: their
 * dimension_value is "all", not a real id, because they're single-number-per-department
 * aggregates, not a breakdown of individual tasks.
 */
export function reportDrillHref(metric: ReportMetricKey, dimensionValue: string | null, departmentFilter?: string): string | null {
  if (!dimensionValue) return null;
  const params = new URLSearchParams();

  switch (metric) {
    case 'task_counts_by_status':
      params.set('status_id', dimensionValue);
      if (departmentFilter) params.set('department_id', departmentFilter);
      break;
    case 'task_counts_by_department':
      params.set('department_id', dimensionValue);
      break;
    case 'task_counts_by_priority':
      params.set('priority_id', dimensionValue);
      if (departmentFilter) params.set('department_id', departmentFilter);
      break;
    case 'overdue_count':
    case 'over_budget_count':
      // dimension_value is the literal string "all" here (see reports.service.ts) — a
      // department-scoped report is the only way to know which tasks these count, so without
      // one there's nothing honest to link to.
      if (!departmentFilter) return null;
      params.set('department_id', departmentFilter);
      params.set(metric === 'overdue_count' ? 'overdue' : 'over_budget', 'true');
      break;
    default:
      if (USER_KEYED_METRICS.has(metric)) {
        if (dimensionValue === 'unassigned') return null;
        params.set('assignee_id', dimensionValue);
        if (departmentFilter) params.set('department_id', departmentFilter);
        break;
      }
      // overdue_rate, over_budget_rate, avg_time_to_completion_hours, sla_compliance_rate,
      // completion_throughput — rates/averages/day-buckets, no per-row task-list equivalent.
      return null;
  }

  return `/tasks?${params.toString()}`;
}
