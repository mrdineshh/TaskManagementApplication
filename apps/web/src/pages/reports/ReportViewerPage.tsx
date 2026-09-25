import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ReportExportFormat } from "@taskapp/shared-types";
import { useExportSavedReport, useReport, useRunReport, triggerBlobDownload } from "../../features/reports/hooks";
import { ReportChart } from "../../features/reports/ReportChart";
import { reportDrillHref } from "../../features/reports/drill";
import { useSessionStore } from "../../lib/auth/session-store";
import { ReportScheduleSection } from "../../features/reports/ReportScheduleSection";
import { BarChart3, ChevronLeft, Download, Pencil, Loader2, AlertCircle } from "lucide-react";

const EXPORT_FORMATS: ReportExportFormat[] = ["csv", "xlsx", "pdf"];

function metricLabel(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReportViewerPage() {
  const { id }          = useParams<{ id: string }>();
  const { data: report } = useReport(id);
  const { data: results, isLoading, isError, error } = useRunReport(id);
  const exportReport  = useExportSavedReport();
  const currentUser   = useSessionStore((s) => s.currentUser);
  const navigate      = useNavigate();
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);

  if (!report) return (
    <div className="space-y-4 animate-fade-in">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
    </div>
  );

  async function handleExport(format: ReportExportFormat) {
    if (!id) return;
    setExporting(format);
    try {
      const blob = await exportReport.mutateAsync({ id, format });
      triggerBlobDownload(blob, `${report!.name.replace(/[^\w-]+/g, "_")}.${format}`);
    } finally {
      setExporting(null);
    }
  }

  const isOwner = report.created_by_id === currentUser?.id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="nav-icon-btn w-8 h-8">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Reports</p>
            <h1 className="text-2xl">{report.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <Link to={`/reports/${id}/edit`} className="btn-neu text-sm gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          )}
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
              className="btn-neu text-xs gap-1.5 uppercase disabled:opacity-50"
            >
              {exporting === format ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {format}
            </button>
          ))}
        </div>
      </div>

      {/* Running state */}
      {isLoading && (
        <div className="neu-card flex flex-col items-center py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: "#2563EB" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Running report…</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="neu-card flex items-center gap-3" style={{ borderLeft: "4px solid #ef4444" }}>
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <p className="text-sm" style={{ color: "#ef4444" }}>{(error as Error)?.message ?? "Failed to run report."}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.metric} className="neu-card space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 shrink-0" style={{ color: "#2563EB" }} />
                <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{metricLabel(result.metric)}</h2>
              </div>
              <ReportChart
                result={result}
                chartType={report.config.chart_type}
                drillHref={(dimensionValue) => reportDrillHref(result.metric, dimensionValue, report.config.filters.department_id)}
                onDrill={(href) => navigate(href)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Schedule section */}
      {isOwner && id && <ReportScheduleSection reportId={id} />}
    </div>
  );
}
