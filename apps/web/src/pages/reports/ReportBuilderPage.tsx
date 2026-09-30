import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ReportChartType, ReportConfig, ReportDateRange, ReportDimension, ReportMetricKey, SavedReport } from "@taskapp/shared-types";
import { reportChartTypes, reportDimensions } from "@taskapp/shared-types";
import { useCreateReport, useReport, useReportMetrics, usePreviewReport, useUpdateReport } from "../../features/reports/hooks";
import { ReportChart } from "../../features/reports/ReportChart";
import { useDepartments } from "../../features/tasks/hooks";
import { useRoles } from "../../features/admin/hooks";
import { DateRangePicker, resolvePreset, type DateRangeResult } from "../../components/DateRangePicker";
import { NeuSelect } from "../../components/NeuSelect";
import { reportDrillHref } from "../../features/reports/drill";
import { BarChart3, Loader2, Play, Save, BarChart2, AlertCircle } from "lucide-react";

function defaultDateRange(): DateRangeResult {
  const { start, end } = resolvePreset("this_month");
  return { preset: "this_month", start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function ReportBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate  = useNavigate();

  const { data: existing }    = useReport(id);
  const { data: catalog }     = useReportMetrics();
  const { data: departments } = useDepartments();
  const { data: roles }       = useRoles();
  const createReport  = useCreateReport();
  const updateReport  = useUpdateReport();
  const previewReport = usePreviewReport();

  const [name, setName]               = useState("");
  const [metrics, setMetrics]         = useState<ReportMetricKey[]>([]);
  const [dimensions, setDimensions]   = useState<ReportDimension[]>([]);
  const [dateRange, setDateRange]     = useState<DateRangeResult>(defaultDateRange());
  const [chartType, setChartType]     = useState<ReportChartType>("bar");
  const [departmentId, setDepartmentId] = useState("");
  const [visibility, setVisibility]   = useState<SavedReport["visibility"]>("private");
  const [sharedRoleIds, setSharedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? "");
    setMetrics(existing.config?.metrics ?? []);
    setDimensions(existing.config?.dimensions ?? []);
    const existingRange = existing.config?.date_range;
    if (existingRange && "preset" in existingRange) {
      const { start, end } = resolvePreset(existingRange.preset);
      setDateRange({ preset: existingRange.preset, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    } else if (existingRange && "start" in existingRange && "end" in existingRange) {
      setDateRange({ preset: null, start: existingRange.start.slice(0, 10), end: existingRange.end.slice(0, 10) });
    }
    if (existing.config?.chart_type) setChartType(existing.config.chart_type);
    setDepartmentId(existing.config?.filters?.department_id ?? "");
    if (existing.visibility) setVisibility(existing.visibility);
    setSharedRoleIds(existing.shared_with_role_ids ?? []);
  }, [existing]);

  function toggleMetric(key: ReportMetricKey) {
    setMetrics((cur) => cur.includes(key) ? cur.filter((m) => m !== key) : [...cur, key]);
  }
  function toggleDimension(dim: ReportDimension) {
    setDimensions((cur) => cur.includes(dim) ? cur.filter((d) => d !== dim) : [...cur, dim]);
  }
  function buildConfig(): ReportConfig {
    const range: ReportDateRange = dateRange.preset
      ? { preset: dateRange.preset }
      : { start: new Date(`${dateRange.start}T00:00:00.000Z`).toISOString(), end: new Date(`${dateRange.end}T23:59:59.999Z`).toISOString() };
    return { metrics, dimensions, date_range: range, chart_type: chartType, filters: departmentId ? { department_id: departmentId } : {} };
  }
  async function handlePreview() {
    if (metrics.length === 0) return;
    await previewReport.mutateAsync(buildConfig());
  }
  async function handleSave() {
    if (!name.trim() || metrics.length === 0) return;
    const data = { name, config: buildConfig(), visibility, shared_with_role_ids: visibility === "shared_roles" ? sharedRoleIds : [] };
    const saved = isEditing && id ? await updateReport.mutateAsync({ id, data }) : await createReport.mutateAsync(data);
    navigate(`/reports/${saved.id}`);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="icon-box-brand"><BarChart3 className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl">{isEditing ? "Edit Report" : "New Report"}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Configure metrics, dimensions, and chart type.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Config panel */}
        <div className="neu-card space-y-5">

          {/* Name */}
          <div>
            <label className="section-label">Report Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="neu-input" placeholder="e.g. Monthly Overdue Summary" />
          </div>

          {/* Metrics */}
          <div>
            <label className="section-label">Metrics</label>
            <div className="space-y-2">
              {catalog?.metrics.map((m) => (
                <label key={m.key} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl transition-colors hover:bg-[rgba(37,99,235,0.04)]">
                  <input
                    type="checkbox"
                    checked={metrics.includes(m.key)}
                    onChange={() => toggleMetric(m.key)}
                    className="mt-1 h-4 w-4 rounded accent-brand-500 cursor-pointer"
                  />
                  <span>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="section-label">Dimensions</label>
            <div className="flex flex-wrap gap-2">
              {reportDimensions.map((dim) => {
                const isSelected = dimensions.includes(dim);
                return (
                  <label
                    key={dim}
                    className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl text-sm font-semibold transition-all select-none"
                    style={isSelected
                      ? { background: "#ffffff", border: "2px solid #2563EB", color: "#0f172a", boxShadow: "0 2px 8px rgba(37,99,235,0.15)" }
                      : { background: "var(--neu-bg)", border: "2px solid transparent", boxShadow: "3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)", color: "var(--text-muted)" }}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggleDimension(dim)} className="sr-only" />
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                    {dim.replace("_", " ")}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Date range & Chart type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="section-label">Date Range</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            <div>
              <label className="section-label">Chart Type</label>
              <NeuSelect
                value={chartType}
                onChange={(v) => setChartType(v as ReportChartType)}
                options={reportChartTypes.map((c) => ({
                  value: c,
                  label: c.charAt(0).toUpperCase() + c.slice(1),
                }))}
                compact
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Department & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="section-label">Department</label>
              <NeuSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={[
                  { value: "", label: "My scope" },
                  ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
                ]}
                placeholder="My scope"
                compact
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="section-label">Visibility</label>
              <NeuSelect
                value={visibility}
                onChange={(v) => setVisibility(v as SavedReport["visibility"])}
                options={[
                  { value: "private", label: "Private" },
                  { value: "shared_roles", label: "Shared with roles" },
                  { value: "shared_org", label: "Org-wide" },
                ]}
                compact
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Shared Roles (if visibility is shared_roles) */}
          {visibility === "shared_roles" && (
            <div className="pt-2">
              <label className="section-label">Roles (select roles)</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {roles?.map((r) => {
                  const isSelected = sharedRoleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSharedRoleIds(isSelected
                          ? sharedRoleIds.filter((id) => id !== r.id)
                          : [...sharedRoleIds, r.id]);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-xl transition-all font-medium ${
                        isSelected
                          ? "border-2 border-blue-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-neu-sm"
                          : "bg-[var(--neu-bg)] text-[var(--text-muted)] hover:bg-[rgba(37,99,235,0.06)] border-2 border-transparent"
                      }`}
                      style={!isSelected ? {
                        boxShadow: "2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)",
                      } : undefined}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <button onClick={handlePreview} disabled={metrics.length === 0 || previewReport.isPending} className="btn-neu gap-2 text-sm disabled:opacity-50">
              {previewReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" style={{ color: "#2563EB" }} />}
              Preview
            </button>
            <button onClick={handleSave} disabled={!name.trim() || metrics.length === 0} className="btn-primary gap-2 text-sm disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> Save Report
            </button>
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-4">
          {previewReport.isError && (
            <div className="neu-card flex items-center gap-3" style={{ borderLeft: "4px solid #ef4444" }}>
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm" style={{ color: "#ef4444" }}>{(previewReport.error as Error)?.message ?? "Preview failed."}</p>
            </div>
          )}
          {previewReport.data?.map((result) => (
            <div key={result.metric} className="neu-card space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 shrink-0" style={{ color: "#2563EB" }} />
                <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{result.metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
              </div>
              <ReportChart
                result={result}
                chartType={chartType}
                drillHref={(dimensionValue) => reportDrillHref(result.metric, dimensionValue, departmentId || undefined)}
                onDrill={(href) => navigate(href)}
              />
            </div>
          ))}
          {!previewReport.data && (
            <div className="neu-card flex flex-col items-center py-14 text-center">
              <BarChart3 className="w-10 h-10 mb-3" style={{ color: "var(--text-faint)", opacity: 0.5 }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Pick metrics and click Preview</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>Your report data will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
