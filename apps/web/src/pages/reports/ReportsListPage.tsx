import { Link } from 'react-router-dom';
import { useDeleteReport, useReports } from '../../features/reports/hooks';
import { useSessionStore } from '../../lib/auth/session-store';

const VISIBILITY_LABEL: Record<string, string> = {
  private: 'Private',
  shared_roles: 'Shared with roles',
  shared_org: 'Org-wide',
};

/** Saved report list (docs/05-FEATURES.md §3.3) — private/shared/org-wide reports the user can see. */
export function ReportsListPage() {
  const { data: reports, isLoading } = useReports();
  const deleteReport = useDeleteReport();
  const currentUser = useSessionStore((s) => s.currentUser);

  const templates = reports?.filter((r) => r.is_template) ?? [];
  const savedReports = reports?.filter((r) => !r.is_template) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Build, save, and schedule reports across your scope.</p>
        </div>
        <Link to="/reports/builder" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          New report
        </Link>
      </div>

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>}

      {templates.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Starter templates</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Saved reports</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Visibility</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {savedReports.map((report) => (
                <tr key={report.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-4 py-2">
                    <Link to={`/reports/${report.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                      {report.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{VISIBILITY_LABEL[report.visibility] ?? report.visibility}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      {report.created_by_id === currentUser?.id && (
                        <Link to={`/reports/${report.id}/edit`} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                          Edit
                        </Link>
                      )}
                      {report.created_by_id === currentUser?.id && (
                        <button onClick={() => deleteReport.mutate(report.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {savedReports.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No saved reports yet — build one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReportCard({ report }: { report: { id: string; name: string } }) {
  return (
    <Link
      to={`/reports/${report.id}`}
      className="block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 hover:shadow"
    >
      {report.name}
    </Link>
  );
}
