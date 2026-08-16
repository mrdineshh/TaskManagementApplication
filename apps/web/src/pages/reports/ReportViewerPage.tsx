import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReportExportFormat } from '@taskapp/shared-types';
import { useExportSavedReport, useReport, useRunReport, triggerBlobDownload } from '../../features/reports/hooks';
import { ReportChart } from '../../features/reports/ReportChart';
import { reportDrillHref } from '../../features/reports/drill';
import { useSessionStore } from '../../lib/auth/session-store';
import { ReportScheduleSection } from '../../features/reports/ReportScheduleSection';

const EXPORT_FORMATS: ReportExportFormat[] = ['csv', 'xlsx', 'pdf'];

/**
 * Runs and displays a SavedReport (docs/05-FEATURES.md §3.1/§3.3), with export + scheduling.
 * Drill-down (docs/10-OPEN-DECISIONS.md §M6): bars/slices/rows whose dimension_value maps to a
 * real filterable id (status/department/priority/assignee) navigate into the task list
 * pre-filtered to exactly that slice — see features/reports/drill.ts for which metrics qualify.
 */
export function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report } = useReport(id);
  const { data: results, isLoading, isError, error } = useRunReport(id);
  const exportReport = useExportSavedReport();
  const currentUser = useSessionStore((s) => s.currentUser);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);

  if (!report) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>;

  async function handleExport(format: ReportExportFormat) {
    if (!id) return;
    setExporting(format);
    try {
      const blob = await exportReport.mutateAsync({ id, format });
      triggerBlobDownload(blob, `${report!.name.replace(/[^\w-]+/g, '_')}.${format}`);
    } finally {
      setExporting(null);
    }
  }

  const isOwner = report.created_by_id === currentUser?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/reports" className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400">
            ← Reports
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{report.name}</h1>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Link to={`/reports/${id}/edit`} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950">
              Edit
            </Link>
          )}
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
            >
              {exporting === format ? '…' : format}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Running report…</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message ?? 'Failed to run report.'}</p>}

      <div className="space-y-4">
        {results?.map((result) => (
          <div key={result.metric} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{metricLabel(result.metric)}</h2>
            <ReportChart
              result={result}
              chartType={report.config.chart_type}
              drillHref={(dimensionValue) => reportDrillHref(result.metric, dimensionValue, report.config.filters.department_id)}
              onDrill={(href) => navigate(href)}
            />
          </div>
        ))}
      </div>

      {isOwner && id && <ReportScheduleSection reportId={id} />}
    </div>
  );
}

function metricLabel(metric: string): string {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
