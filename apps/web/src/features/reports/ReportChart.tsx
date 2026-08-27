import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportChartType, ReportRunResult } from '@taskapp/shared-types';

// Studio Desk direction (docs/10-OPEN-DECISIONS.md §M5) — forest green (brand-500) leading a
// warm-leaning categorical set, with enough hue spread to stay distinguishable across 8 series.
const COLORS = ['#2b6357', '#c98a2c', '#6b4fa0', '#b4483a', '#3f7cac', '#7a8b4f', '#a2586b', '#4e8b8b'];

interface Props {
  result: ReportRunResult;
  chartType: ReportChartType;
  /** Returns a /tasks?... href for a row, or null if that row has no honest task-list equivalent
   *  (docs/10-OPEN-DECISIONS.md §M6 — see features/reports/drill.ts for which metrics qualify). */
  drillHref?: (dimensionValue: string | null) => string | null;
  onDrill?: (href: string) => void;
}

export function ReportChart({ result, chartType, drillHref, onDrill }: Props) {
  const data = result.rows.map((r) => ({ name: r.dimension_label, value: r.value, href: drillHref?.(r.dimension_value) ?? null }));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No data for the selected range.</p>;
  }

  const anyDrillable = data.some((d) => d.href);
  // Count-style metrics (task counts) are always whole numbers — Recharts otherwise picks
  // decimal tick marks (0.5, 1.5, ...) for small ranges, which reads as nonsense for a count.
  // Rate/average/throughput metrics are legitimately fractional, so only force this when every
  // value in this particular chart actually is a whole number.
  const allIntegers = data.every((d) => Number.isInteger(d.value));

  if (chartType === 'table') {
    return (
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Dimension</th>
            <th className="px-3 py-2">Value</th>
            {anyDrillable && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr
              key={d.name}
              onClick={() => d.href && onDrill?.(d.href)}
              className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${d.href ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950' : ''}`}
            >
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{d.name}</td>
              <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{formatValue(d.value)}</td>
              {anyDrillable && <td className="px-3 py-2 text-right text-brand-600 dark:text-brand-400">{d.href && '→'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={COLORS[i % COLORS.length]}
                cursor={d.href ? 'pointer' : 'default'}
                onClick={() => d.href && onDrill?.(d.href)}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={!allIntegers} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2b6357" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={!allIntegers} />
        <Tooltip />
        <Bar
          dataKey="value"
          fill="#2b6357"
          radius={[4, 4, 0, 0]}
          cursor={anyDrillable ? 'pointer' : 'default'}
          onClick={(point: unknown) => {
            const href = (point as { href: string | null } | undefined)?.href;
            if (href) onDrill?.(href);
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
