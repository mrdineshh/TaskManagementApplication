import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ReportChartType, ReportConfig, ReportDateRange, ReportDimension, ReportMetricKey, SavedReport } from '@taskapp/shared-types';
import { reportChartTypes, reportDimensions } from '@taskapp/shared-types';
import { useCreateReport, useReport, useReportMetrics, usePreviewReport, useUpdateReport } from '../../features/reports/hooks';
import { ReportChart } from '../../features/reports/ReportChart';
import { useDepartments } from '../../features/tasks/hooks';
import { useRoles } from '../../features/admin/hooks';

const DATE_PRESETS = ['last_7_days', 'last_30_days', 'this_month', 'this_quarter', 'this_year'] as const;

/** Custom report builder (docs/05-FEATURES.md §3.3) — pick metrics, dimensions, date range, chart type, filters. */
export function ReportBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const { data: existing } = useReport(id);
  const { data: catalog } = useReportMetrics();
  const { data: departments } = useDepartments();
  const { data: roles } = useRoles();
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const previewReport = usePreviewReport();

  const [name, setName] = useState('');
  const [metrics, setMetrics] = useState<ReportMetricKey[]>([]);
  const [dimensions, setDimensions] = useState<ReportDimension[]>([]);
  const [preset, setPreset] = useState<(typeof DATE_PRESETS)[number]>('last_30_days');
  const [chartType, setChartType] = useState<ReportChartType>('bar');
  const [departmentId, setDepartmentId] = useState('');
  const [visibility, setVisibility] = useState<SavedReport['visibility']>('private');
  const [sharedRoleIds, setSharedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setMetrics(existing.config.metrics);
    setDimensions(existing.config.dimensions);
    if ('preset' in existing.config.date_range) setPreset(existing.config.date_range.preset);
    setChartType(existing.config.chart_type);
    setDepartmentId(existing.config.filters.department_id ?? '');
    setVisibility(existing.visibility);
    setSharedRoleIds(existing.shared_with_role_ids);
  }, [existing]);

  function toggleMetric(key: ReportMetricKey) {
    setMetrics((cur) => (cur.includes(key) ? cur.filter((m) => m !== key) : [...cur, key]));
  }

  function toggleDimension(dim: ReportDimension) {
    setDimensions((cur) => (cur.includes(dim) ? cur.filter((d) => d !== dim) : [...cur, dim]));
  }

  function buildConfig(): ReportConfig {
    const dateRange: ReportDateRange = { preset };
    return {
      metrics,
      dimensions,
      date_range: dateRange,
      chart_type: chartType,
      filters: departmentId ? { department_id: departmentId } : {},
    };
  }

  async function handlePreview() {
    if (metrics.length === 0) return;
    await previewReport.mutateAsync(buildConfig());
  }

  async function handleSave() {
    if (!name.trim() || metrics.length === 0) return;
    const data = { name, config: buildConfig(), visibility, shared_with_role_ids: visibility === 'shared_roles' ? sharedRoleIds : [] };
    const saved = isEditing && id ? await updateReport.mutateAsync({ id, data }) : await createReport.mutateAsync(data);
    navigate(`/reports/${saved.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{isEditing ? 'Edit report' : 'New report'}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Report name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Metrics</label>
            <div className="space-y-1">
              {catalog?.metrics.map((m) => (
                <label key={m.key} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={metrics.includes(m.key)} onChange={() => toggleMetric(m.key)} className="mt-0.5" />
                  <span>
                    {m.label}
                    <span className="block text-xs text-slate-400 dark:text-slate-500">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Dimensions</label>
            <div className="flex flex-wrap gap-3">
              {reportDimensions.map((dim) => (
                <label key={dim} className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={dimensions.includes(dim)} onChange={() => toggleDimension(dim)} />
                  {dim.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Date range</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value as (typeof DATE_PRESETS)[number])} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm">
                {DATE_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Chart type</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value as ReportChartType)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm">
                {reportChartTypes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Department</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm">
                <option value="">My scope</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as SavedReport['visibility'])} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm">
                <option value="private">Private</option>
                <option value="shared_roles">Shared with roles</option>
                <option value="shared_org">Org-wide</option>
              </select>
            </div>
            {visibility === 'shared_roles' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Roles</label>
                <select
                  multiple
                  value={sharedRoleIds}
                  onChange={(e) => setSharedRoleIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  className="h-16 w-48 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                >
                  {roles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              onClick={handlePreview}
              disabled={metrics.length === 0 || previewReport.isPending}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
            >
              {previewReport.isPending ? 'Running…' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || metrics.length === 0}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Save report
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {previewReport.isError && <p className="text-sm text-red-600 dark:text-red-400">{(previewReport.error as Error)?.message ?? 'Preview failed.'}</p>}
          {previewReport.data?.map((result) => (
            <div key={result.metric} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{result.metric.replace(/_/g, ' ')}</h2>
              <ReportChart result={result} chartType={chartType} />
            </div>
          ))}
          {!previewReport.data && <p className="text-sm text-slate-400 dark:text-slate-500">Pick metrics and click Preview to see the data.</p>}
        </div>
      </div>
    </div>
  );
}
