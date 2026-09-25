import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReportChartType, ReportMetricKey, ReportRunResult } from '@taskapp/shared-types';

// Curated categorical palette for rich visual distinction
const COLORS = [
  '#2563eb', // royal blue
  '#10b981', // emerald green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_KEYED_METRICS = new Set<ReportMetricKey>([
  'task_counts_by_assignee',
  'workload_distribution',
  'time_tracked_minutes',
]);

function toTitleCase(str: string): string {
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Sanitizes any raw UUID or unformatted key into a clean, human-friendly label */
export function cleanDimensionLabel(label: string, metric: ReportMetricKey): string {
  if (
    !label ||
    label === 'unassigned' ||
    label === 'null' ||
    label === 'undefined' ||
    label.toLowerCase() === 'unassigned' ||
    label.toLowerCase() === 'n/a' ||
    label === 'NA'
  ) {
    return 'N/A';
  }
  if (label.toLowerCase() === 'all') return 'All';

  // If a raw UUID leaked into dimension_label (e.g. from an unmapped or deleted DB record)
  if (UUID_REGEX.test(label)) {
    if (USER_KEYED_METRICS.has(metric)) return 'N/A';
    if (metric === 'task_counts_by_status') return 'Other Status';
    if (metric === 'task_counts_by_department') return 'Other Department';
    if (metric === 'task_counts_by_priority') return 'Other Priority';
    return 'N/A';
  }

  // Format snake_case or slug strings (e.g. in_progress -> In Progress)
  if (label.includes('_') || (label.includes('-') && !label.includes(' '))) {
    return toTitleCase(label);
  }

  return label;
}

/** Shortens names for cramped axis ticks while keeping full names in tooltips and tables */
export function formatAxisTick(label: string): string {
  if (!label || label === 'N/A') return 'N/A';
  if (label.toLowerCase() === 'all') return 'All';

  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    // E.g. "Dinesh Harikrishnan" -> "Dinesh H."
    // "VAISHNAVI NM" -> "Vaishnavi N."
    // "PARDHESH MADDALA" -> "Pardhesh M."
    // "Jithin Murthy B" -> "Jithin M."
    // "Ratnesh Singh" -> "Ratnesh S."
    const first = toTitleCase(words[0]);
    const secondInitial = words[1][0]?.toUpperCase() ?? '';
    return `${first} ${secondInitial}.`;
  }

  // Single word: if longer than 11 chars, truncate
  if (label.length > 11) {
    return `${toTitleCase(label.slice(0, 10))}…`;
  }
  return toTitleCase(label);
}

/** Custom SVG tick that renders rotated labels cleanly without ever overlapping adjacent ticks */
function CustomizedAxisTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  const raw = String(payload?.value ?? '');
  const display = formatAxisTick(raw);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        dx={-6}
        textAnchor="end"
        transform="rotate(-40)"
        className="text-[11px] fill-slate-500 dark:fill-slate-400 font-medium select-none"
      >
        {display}
      </text>
    </g>
  );
}

/** Returns the semantic human name for what a metric value actually represents */
export function getMetricLabel(metric: ReportMetricKey): string {
  switch (metric) {
    case 'task_counts_by_status':
    case 'task_counts_by_department':
    case 'task_counts_by_assignee':
    case 'task_counts_by_priority':
      return 'Tasks';
    case 'overdue_count':
      return 'Overdue Tasks';
    case 'overdue_rate':
      return 'Overdue Rate';
    case 'over_budget_count':
      return 'Over-Budget Tasks';
    case 'over_budget_rate':
      return 'Over-Budget Rate';
    case 'avg_time_to_completion_hours':
      return 'Avg. Completion Time';
    case 'sla_compliance_rate':
      return 'SLA Compliance';
    case 'workload_distribution':
      return 'Open Tasks';
    case 'time_tracked_minutes':
      return 'Time Logged';
    case 'completion_throughput':
      return 'Tasks Completed';
    default:
      return toTitleCase(metric);
  }
}

/** Returns the appropriate column header for the dimension */
export function getDimensionColumnHeader(metric: ReportMetricKey): string {
  if (USER_KEYED_METRICS.has(metric)) return 'Assignee / Team Member';
  if (metric === 'task_counts_by_status') return 'Workflow Status';
  if (metric === 'task_counts_by_department') return 'Department';
  if (metric === 'task_counts_by_priority') return 'Priority';
  if (metric === 'completion_throughput') return 'Time Period';
  return 'Dimension';
}

/** Formats a numeric metric value with appropriate unit (hours, minutes, percent, or integer count) */
export function formatMetricValue(value: number, metric: ReportMetricKey): string {
  if (metric === 'time_tracked_minutes') {
    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
  if (metric === 'avg_time_to_completion_hours') {
    return `${value.toFixed(1)}h`;
  }
  if (metric === 'overdue_rate' || metric === 'over_budget_rate' || metric === 'sla_compliance_rate') {
    return `${value.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; color?: string; name?: string }>;
  label?: string;
  metric: ReportMetricKey;
}

function CustomReportTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const cleanName = cleanDimensionLabel(String(label ?? p.name ?? ''), metric);
  const isNA = cleanName === 'N/A';
  const metricLabel = getMetricLabel(metric);
  const formattedVal = formatMetricValue(p.value, metric);

  return (
    <div
      className="px-3.5 py-2.5 rounded-xl text-xs font-medium neu-card shadow-lg"
      style={{
        background: 'var(--neu-bg, #ffffff)',
        boxShadow: '4px 4px 12px var(--neu-dark, rgba(0,0,0,0.12)), -4px -4px 12px var(--neu-light, rgba(255,255,255,0.9))',
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1.5">
        <span>{cleanName}</span>
        {isNA && (
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Unassigned / Deleted
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: p.color || '#2563eb' }} />
        <span className="text-slate-500 dark:text-slate-400">{metricLabel}:</span>
        <span className="font-bold text-slate-900 dark:text-slate-100">{formattedVal}</span>
      </div>
    </div>
  );
}

interface Props {
  result: ReportRunResult;
  chartType: ReportChartType;
  /** Returns a /tasks?... href for a row, or null if that row has no honest task-list equivalent
   *  (docs/10-OPEN-DECISIONS.md §M6 — see features/reports/drill.ts for which metrics qualify). */
  drillHref?: (dimensionValue: string | null) => string | null;
  onDrill?: (href: string) => void;
}

export function ReportChart({ result, chartType, drillHref, onDrill }: Props) {
  const [barOrientation, setBarOrientation] = useState<'column' | 'bar'>('column');

  // Consolidate rows with duplicate labels (e.g. multiple deleted/unassigned users into a single N/A bar)
  const consolidatedMap = new Map<string, { name: string; value: number; href: string | null; isNA: boolean }>();
  for (const r of result.rows) {
    const name = cleanDimensionLabel(r.dimension_label, result.metric);
    const isNA = name === 'N/A';
    const existing = consolidatedMap.get(name);
    if (existing) {
      existing.value += r.value;
      if (!existing.href && r.dimension_value) {
        existing.href = drillHref?.(r.dimension_value) ?? null;
      }
    } else {
      consolidatedMap.set(name, {
        name,
        value: r.value,
        href: drillHref?.(r.dimension_value) ?? null,
        isNA,
      });
    }
  }

  // Active / named users appear first, and N/A appears at the end
  const data = Array.from(consolidatedMap.values()).sort((a, b) => {
    if (a.isNA && !b.isNA) return 1;
    if (!a.isNA && b.isNA) return -1;
    return 0;
  });

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No data for the selected range.</p>;
  }

  const hasNA = data.some((d) => d.isNA);
  const anyDrillable = data.some((d) => d.href);
  const allIntegers = data.every((d) => Number.isInteger(d.value));

  return (
    <div className="space-y-3">
      {/* Table Chart */}
      {chartType === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5">{getDimensionColumnHeader(result.metric)}</th>
                <th className="px-3 py-2.5 text-right">{getMetricLabel(result.metric)}</th>
                {anyDrillable && <th className="px-3 py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {data.map((d, i) => (
                <tr
                  key={`${d.name}-${i}`}
                  onClick={() => d.href && onDrill?.(d.href)}
                  className={`transition-colors ${d.href ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/40' : ''}`}
                >
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium break-words leading-snug">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span>{d.name}</span>
                      {d.isNA && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          (Unassigned / Deleted)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatMetricValue(d.value, result.metric)}
                  </td>
                  {anyDrillable && (
                    <td className="px-3 py-2.5 text-right text-brand-600 dark:text-brand-400 font-bold">
                      {d.href && '→'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pie Chart with Clean Legends (No overlapping slice labels) */}
      {chartType === 'pie' && (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                innerRadius={48}
                paddingAngle={2}
              >
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    cursor={d.href ? 'pointer' : 'default'}
                    onClick={() => d.href && onDrill?.(d.href)}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomReportTooltip metric={result.metric} />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Clean Legend Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {data.map((d, i) => (
              <button
                key={d.name}
                type="button"
                onClick={() => d.href && onDrill?.(d.href)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  d.href ? 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  background: 'var(--neu-bg, #f8fafc)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                <span className="text-slate-400 dark:text-slate-500 font-bold text-[11px]">({formatMetricValue(d.value, result.metric)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Line Chart with Non-Overlapping Angled Ticks */}
      {chartType === 'line' && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="name"
              interval={0}
              height={65}
              tick={<CustomizedAxisTick />}
            />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted, #64748b)' }} allowDecimals={!allIntegers} />
            <Tooltip content={<CustomReportTooltip metric={result.metric} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#2563eb' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Bar Chart with Layout Switcher (Vertical Columns vs Horizontal Rows) */}
      {chartType === 'bar' && (
        <div className="space-y-2">
          {/* Controls: layout toggle */}
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {data.length} {data.length === 1 ? 'item' : 'items'}
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setBarOrientation('column')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  barOrientation === 'column'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Columns
              </button>
              <button
                type="button"
                onClick={() => setBarOrientation('bar')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  barOrientation === 'bar'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Horizontal Rows
              </button>
            </div>
          </div>

          {barOrientation === 'column' ? (
            /* Vertical Columns: Angled Ticks with -40deg guarantees ZERO overlap */
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={65}
                  tick={<CustomizedAxisTick />}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted, #64748b)' }} allowDecimals={!allIntegers} />
                <Tooltip content={<CustomReportTooltip metric={result.metric} />} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  cursor={anyDrillable ? 'pointer' : 'default'}
                  onClick={(point: unknown) => {
                    const href = (point as { href: string | null } | undefined)?.href;
                    if (href) onDrill?.(href);
                  }}
                >
                  {data.map((_, i) => (
                    <Cell key={`bar-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            /* Horizontal Rows: Names on Y-axis have unlimited horizontal room, 100% collision-free */
            <ResponsiveContainer width="100%" height={Math.max(260, data.length * 42)}>
              <BarChart layout="vertical" data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--text-muted, #64748b)' }}
                  allowDecimals={!allIntegers}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'var(--text-muted, #64748b)' }}
                  tickFormatter={(v) => (String(v).length > 15 ? `${String(v).slice(0, 13)}…` : String(v))}
                />
                <Tooltip content={<CustomReportTooltip metric={result.metric} />} />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  cursor={anyDrillable ? 'pointer' : 'default'}
                  onClick={(point: unknown) => {
                    const href = (point as { href: string | null } | undefined)?.href;
                    if (href) onDrill?.(href);
                  }}
                >
                  {data.map((_, i) => (
                    <Cell key={`bar-h-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Explanatory tag when N/A is present in the report data */}
      {hasNA && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
            N/A
          </span>
          <span className="text-[11px]">= Unassigned tasks or deleted team members</span>
        </div>
      )}
    </div>
  );
}
