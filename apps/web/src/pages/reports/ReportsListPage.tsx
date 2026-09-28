import { Link } from "react-router-dom";
import { BarChart3, Plus, Eye, Pencil, Trash2, Lock, Globe, Users } from "lucide-react";
import { useDeleteReport, useReports } from "../../features/reports/hooks";
import { useSessionStore } from "../../lib/auth/session-store";
import { EmptyState } from "../../components/EmptyState";

const VISIBILITY_META: Record<string, { label: string; color: string; bg: string; icon: typeof Globe }> = {
  private:      { label: "Private",           color: "#6b7898", bg: "rgba(107,120,152,0.1)", icon: Lock   },
  shared_roles: { label: "Shared with roles", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  icon: Users  },
  shared_org:   { label: "Org-wide",          color: "#10b981", bg: "rgba(16,185,129,0.1)",  icon: Globe  },
};

function ReportCard({ report }: { report: { id: string; name: string; visibility?: string } }) {
  const meta = VISIBILITY_META[report.visibility ?? "private"] ?? VISIBILITY_META.private;
  const Icon = meta.icon;
  return (
    <Link
      to={`/reports/${report.id}`}
      className="neu-card group flex items-start gap-3 !p-4"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform group-hover:scale-105" style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}>
        <BarChart3 className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>{report.name}</p>
        <span className="badge mt-1" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
          <Icon className="w-3 h-3" /> {meta.label}
        </span>
      </div>
    </Link>
  );
}

export function ReportsListPage() {
  const { data: reports, isLoading } = useReports();
  const deleteReport = useDeleteReport();
  const currentUser  = useSessionStore((s) => s.currentUser);

  const templates   = reports?.filter((r) => r.is_template)  ?? [];
  const savedReports = reports?.filter((r) => !r.is_template) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-box-brand"><BarChart3 className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl">Reports</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Build, save, and schedule reports across your scope.</p>
          </div>
        </div>
        <Link to="/reports/builder" className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Report
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl skeleton" />)}
        </div>
      )}

      {/* Starter templates */}
      {templates.length > 0 && (
        <section className="space-y-3">
          <p className="section-label">Starter Templates</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((report) => <ReportCard key={report.id} report={report} />)}
          </div>
        </section>
      )}

      {/* Saved reports */}
      <section className="space-y-3">
        <p className="section-label">Saved Reports</p>
        {savedReports.length === 0 && !isLoading ? (
          <div className="neu-card flex flex-col items-center py-12 text-center">
            <EmptyState
              icon={<BarChart3 className="w-8 h-8" style={{ color: "var(--text-faint)" }} />}
              title="No saved reports yet"
              subtitle="Build a report from your task data — filter, group, and chart any metric."
              linkAction={{ label: "Build a report", href: "/reports/builder" }}
            />
          </div>
        ) : (
          <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
            <table className="neu-table">
              <thead>
                <tr>
                  <th className="pl-5">Name</th>
                  <th>Visibility</th>
                  <th className="text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedReports.map((report) => {
                  const meta = VISIBILITY_META[report.visibility ?? "private"] ?? VISIBILITY_META.private;
                  const VisIcon = meta.icon;
                  const isOwner = report.created_by_id === currentUser?.id;
                  return (
                    <tr key={report.id}>
                      <td className="pl-5">
                        <Link to={`/reports/${report.id}`} className="font-semibold text-sm hover:underline flex items-center gap-2 break-words leading-snug" style={{ color: "#2563EB" }}>
                          <BarChart3 className="w-3.5 h-3.5 shrink-0" /> <span className="break-words leading-snug">{report.name}</span>
                        </Link>
                      </td>
                      <td>
                        <span className="badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                          <VisIcon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="text-right pr-5">
                        <div className="inline-flex items-center gap-2">
                          <Link to={`/reports/${report.id}`} className="nav-icon-btn w-7 h-7 !rounded-lg" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {isOwner && (
                            <Link to={`/reports/${report.id}/edit`} className="nav-icon-btn w-7 h-7 !rounded-lg" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => deleteReport.mutate(report.id)}
                              className="nav-icon-btn w-7 h-7 !rounded-lg hover:!text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
