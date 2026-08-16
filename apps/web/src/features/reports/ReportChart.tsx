import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportChartType, ReportRunResult } from '@taskapp/shared-types';

// Studio Desk direction (docs/10-OPEN-DECISIONS.md §M5) — forest green (brand-500) leading a
// warm-leaning categorical set, with enough hue spread to stay distinguishable across 8 series.
const COLORS = ['#2b6357', '#c98a2c', '#6b4fa0', '#b4483a', '#3f7cac', '#7a8b4f', '#a2586b', '#4e8b8b'];

export function ReportChart({ result, chartType }: { result: ReportRunResult; chartType: ReportChartType }) {
  const data = result.rows.map((r) => ({ name: r.dimension_label, value: r.value }));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No data for the selected range.</p>;
  }

  if (chartType === 'table') {
    return (
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Dimension</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{d.name}</td>
              <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{formatValue(d.value)}</td>
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
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
          <YAxis tick={{ fontSize: 11 }} />
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
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#2b6357" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
