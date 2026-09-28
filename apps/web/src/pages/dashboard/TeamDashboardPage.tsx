import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, ChevronRight, ChevronDown, AlertCircle, Clock, TrendingUp, Building2 } from "lucide-react";
import { useTeamDashboard } from "../../features/tasks/hooks";

interface StatusCount  { status_id: string; label: string; color: string | null; count: number; }
interface TeamStats    { counts_by_status: StatusCount[]; overdue_count: number; over_budget_count: number; open_count: number; }
interface Member       { id: string; full_name?: string; fullName?: string; manager_id?: string; managerId?: string; }
interface ManagerBreakdown  extends TeamStats { manager_id: string; manager_name: string; member_count: number; }
interface DepartmentSummary extends TeamStats { department_id: string; department_name: string; member_count: number; }

function memberName(m: Member) { return m.full_name ?? m.fullName ?? "Unknown"; }

function StatusBadges({ statuses }: { statuses?: StatusCount[] }) {
  const list = statuses ?? [];
  if (list.length === 0) return <span className="text-xs" style={{ color: "var(--text-faint)" }}>No open tasks</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {list.map((s) => (
        <span
          key={s.status_id}
          className="badge"
          style={{ backgroundColor: `${s.color ?? "#94a3b8"}18`, color: s.color ?? "#475569", border: `1px solid ${s.color ?? "#94a3b8"}30` }}
        >
          {s.label}: {s.count}
        </span>
      ))}
    </div>
  );
}

function StatRow({ stats, linkParams }: { stats: TeamStats; linkParams: Record<string, string> | null }) {
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...linkParams, ...extra }).toString();
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs">
      <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
        <TrendingUp className="w-3 h-3" style={{ color: "#2563EB" }} />
        Open: <strong className="ml-0.5" style={{ color: "var(--text-primary)" }}>{stats.open_count}</strong>
      </span>
      {linkParams ? (
        <Link to={`/tasks?${qs({ overdue: "true" })}`} className="flex items-center gap-1 hover:underline" style={{ color: "#ef4444" }} onClick={(e) => e.stopPropagation()}>
          <AlertCircle className="w-3 h-3" /> Overdue: <strong className="ml-0.5">{stats.overdue_count}</strong>
        </Link>
      ) : (
        <span className="flex items-center gap-1" style={{ color: "#ef4444" }}>
          <AlertCircle className="w-3 h-3" /> Overdue: <strong className="ml-0.5">{stats.overdue_count}</strong>
        </span>
      )}
      {linkParams ? (
        <Link to={`/tasks?${qs({ over_budget: "true" })}`} className="flex items-center gap-1 hover:underline" style={{ color: "#f97316" }} onClick={(e) => e.stopPropagation()}>
          <Clock className="w-3 h-3" /> Over budget: <strong className="ml-0.5">{stats.over_budget_count}</strong>
        </Link>
      ) : (
        <span className="flex items-center gap-1" style={{ color: "#f97316" }}>
          <Clock className="w-3 h-3" /> Over budget: <strong className="ml-0.5">{stats.over_budget_count}</strong>
        </span>
      )}
    </div>
  );
}

function Breadcrumb({ trail }: { trail: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
      {trail.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          {crumb.onClick ? (
            <button onClick={crumb.onClick} className="font-semibold hover:underline" style={{ color: "#2563EB" }}>{crumb.label}</button>
          ) : (
            <span className={i === trail.length - 1 ? "font-semibold" : ""} style={i === trail.length - 1 ? { color: "var(--text-muted)" } : undefined}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function TeamDashboardPage() {
  const [departmentId, setDepartmentId]       = useState<string | undefined>(undefined);
  const [expandedManagerId, setExpandedManagerId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useTeamDashboard(departmentId);
  const d = data as any;

  if (isLoading) return (
    <div className="space-y-4 animate-fade-in">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
    </div>
  );

  if (!d || d.scope === "none") return (
    <div className="neu-card flex flex-col items-center py-12 text-center animate-fade-in">
      <Users className="w-10 h-10 mb-3" style={{ color: "var(--text-faint)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No team view for your current role.</p>
    </div>
  );

  if (d.scope === "manager") {
    const members: Member[] = Array.isArray(d.members) ? d.members : [];
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="icon-box-brand"><Users className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl">My Team</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{members.length} direct reports</p>
          </div>
        </div>
        <div className="neu-card">
          <StatusBadges statuses={d.counts_by_status ?? []} />
          <StatRow stats={d} linkParams={members.length ? { assignee_id: members.map((m: Member) => m.id).join(",") } : null} />
        </div>
        <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
          <div className="px-5 py-3.5 font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <Users className="w-4 h-4" style={{ color: "#2563EB" }} /> Direct Reports ({members.length})
          </div>
          <ul>
            {members.map((m: Member) => (
              <li key={m.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <Link
                  to={`/tasks?assignee_id=${m.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm font-semibold hover:bg-[rgba(37,99,235,0.04)] transition-colors"
                  style={{ color: "#2563EB" }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)" }}>
                    {memberName(m).charAt(0)}
                  </div>
                  {memberName(m)}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-faint)" }} />
                </Link>
              </li>
            ))}
            {members.length === 0 && (
              <li className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No direct reports assigned yet.</li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  if (d.scope === "department") {
    const members: Member[]              = Array.isArray(d.members)    ? d.members    : [];
    const byManager: ManagerBreakdown[]  = Array.isArray(d.by_manager) ? d.by_manager : [];
    const membersByManager               = (mid: string) => members.filter((m) => (m.manager_id ?? m.managerId) === mid);
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <Breadcrumb trail={[
            { label: "Organization", onClick: departmentId ? () => setDepartmentId(undefined) : undefined },
            { label: d.department_name ?? "Department" },
          ]} />
          <Link to="/scorecard" className="btn-ghost text-xs gap-1"><TrendingUp className="w-3 h-3" /> View leaderboard</Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="icon-box-brand"><Building2 className="w-5 h-5" /></div>
          <h1 className="text-2xl">{d.department_name ?? "Department"}</h1>
        </div>
        <div className="neu-card">
          <StatusBadges statuses={d.counts_by_status ?? []} />
          <StatRow stats={d} linkParams={{ department_id: d.department_id }} />
        </div>
        <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
          <div className="px-5 py-3.5 font-bold text-sm" style={{ color: "var(--text-primary)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>By Manager</div>
          <ul>
            {byManager.map((m: ManagerBreakdown) => {
              const expanded = expandedManagerId === m.manager_id;
              const reports  = membersByManager(m.manager_id);
              return (
                <li key={m.manager_id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="px-5 py-3.5">
                    <button
                      onClick={() => setExpandedManagerId(expanded ? undefined : m.manager_id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="flex items-center gap-2 font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        {expanded ? <ChevronDown className="w-4 h-4" style={{ color: "#2563EB" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "var(--text-faint)" }} />}
                        {m.manager_name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{m.member_count} direct reports</span>
                    </button>
                    <div className="pl-6">
                      <StatRow stats={m} linkParams={reports.length ? { assignee_id: reports.map((r) => r.id).join(",") } : null} />
                    </div>
                  </div>
                  {expanded && (
                    <ul className="pl-5" style={{ background: "rgba(37,99,235,0.02)", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                      {reports.map((r) => (
                        <li key={r.id}>
                          <Link to={`/tasks?assignee_id=${r.id}`} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold hover:bg-[rgba(37,99,235,0.04)] transition-colors" style={{ color: "#2563EB" }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)" }}>
                              {memberName(r).charAt(0)}
                            </div>
                            {memberName(r)}
                          </Link>
                        </li>
                      ))}
                      {reports.length === 0 && <li className="px-5 py-3 text-xs" style={{ color: "var(--text-faint)" }}>No direct reports.</li>}
                    </ul>
                  )}
                </li>
              );
            })}
            {byManager.length === 0 && <li className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No managers assigned in this department yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  // scope === "org"
  const departmentsList: DepartmentSummary[] = Array.isArray(d.departments) ? d.departments : [];
  return (
    <div className="space-y-5 animate-fade-in">
      <Breadcrumb trail={[{ label: "Organization" }]} />
      <div className="flex items-center gap-3">
        <div className="icon-box-brand"><Building2 className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl">Organization</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{departmentsList.length} departments</p>
        </div>
      </div>
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="px-5 py-3.5 font-bold text-sm" style={{ color: "var(--text-primary)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>By Department</div>
        <ul>
          {departmentsList.map((dept: DepartmentSummary) => (
            <li key={dept.department_id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
              <div className="px-5 py-3.5">
                <button onClick={() => setDepartmentId(dept.department_id)} className="flex w-full items-center justify-between text-left group">
                  <span className="flex items-center gap-2 font-semibold text-sm group-hover:underline" style={{ color: "#2563EB" }}>
                    <Building2 className="w-4 h-4" />
                    {dept.department_name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{dept.member_count} members</span>
                </button>
                <StatRow stats={dept} linkParams={{ department_id: dept.department_id }} />
              </div>
            </li>
          ))}
          {departmentsList.length === 0 && <li className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No departments configured yet.</li>}
        </ul>
      </div>
    </div>
  );
}
