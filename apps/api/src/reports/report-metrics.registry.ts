import type { ReportMetricDefinition } from '@taskapp/shared-types';

/**
 * The registered metric catalog backing the report builder (docs/05-FEATURES.md §3.2/§3.3).
 * Adding a metric here plus a corresponding aggregation in ReportAggregationService and a
 * read case in ReportsService is the whole extension point — no other code changes needed,
 * per the "admin-configurable everything" / code-registered-metrics principle.
 */
export const REPORT_METRIC_DEFINITIONS: ReportMetricDefinition[] = [
  {
    key: 'task_counts_by_status',
    label: 'Task Counts by Status',
    description: 'Number of open tasks in each workflow status.',
    supported_dimensions: ['department', 'time_period'],
    requires_v11_data: false,
  },
  {
    key: 'task_counts_by_department',
    label: 'Task Counts by Department',
    description: 'Total task count per department, org-wide.',
    supported_dimensions: ['time_period'],
    requires_v11_data: false,
  },
  {
    key: 'task_counts_by_assignee',
    label: 'Task Counts by Assignee',
    description: 'Number of tasks assigned to each person.',
    supported_dimensions: ['department', 'time_period'],
    requires_v11_data: false,
  },
  {
    key: 'task_counts_by_priority',
    label: 'Task Counts by Priority',
    description: 'Number of open tasks at each priority level.',
    supported_dimensions: ['department', 'time_period'],
    requires_v11_data: false,
  },
  {
    key: 'overdue_count',
    label: 'Overdue Tasks',
    description: 'Count of open tasks past their due date.',
    supported_dimensions: ['department'],
    requires_v11_data: false,
  },
  {
    key: 'overdue_rate',
    label: 'Overdue Rate',
    description: 'Percentage of open tasks that are overdue.',
    supported_dimensions: ['department'],
    requires_v11_data: false,
  },
  {
    key: 'avg_time_to_completion_hours',
    label: 'Avg. Time to Completion',
    description: 'Average hours from task creation to completion, last 30 days.',
    supported_dimensions: ['department'],
    requires_v11_data: false,
  },
  {
    key: 'sla_compliance_rate',
    label: 'SLA Compliance Rate',
    description: 'Percentage of SLA-tracked tasks completed within their resolution time, last 30 days.',
    supported_dimensions: ['department'],
    requires_v11_data: true,
  },
  {
    key: 'workload_distribution',
    label: 'Workload Distribution',
    description: 'Open task count per assignee, for balancing workload.',
    supported_dimensions: ['department'],
    requires_v11_data: false,
  },
  {
    key: 'time_tracked_minutes',
    label: 'Time Tracked',
    description: 'Minutes logged per person, last 30 days.',
    supported_dimensions: ['department'],
    requires_v11_data: true,
  },
  {
    key: 'completion_throughput',
    label: 'Completion Throughput',
    description: 'Number of tasks completed per day.',
    supported_dimensions: ['department', 'time_period'],
    requires_v11_data: false,
  },
];
