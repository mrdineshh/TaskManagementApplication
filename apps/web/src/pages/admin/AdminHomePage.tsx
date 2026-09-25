import { Link } from "react-router-dom";
import {
  Building2, Shield, Users, Sliders, Tags, Target,
  Clock, Calendar, PauseCircle, BarChart3, Plug, Settings,
  Rocket, CheckCircle2, Circle, AlertTriangle, ChevronRight,
} from "lucide-react";
import { useDepartmentsAdmin, useRoles, usePermissionKeys, useUsersAdmin, useWorkflowsAdmin, useSLAPolicies } from "../../features/admin/hooks";

const ADMIN_SECTIONS = [
  { to: "/admin/departments",       title: "Departments",       icon: Building2,  color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  description: "Manage department structure, heads, and member access." },
  { to: "/admin/roles",             title: "Roles & Permissions",icon: Shield,    color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  description: "Define roles and grant or revoke permission keys." },
  { to: "/admin/users",             title: "Users",             icon: Users,      color: "#10b981", bg: "rgba(16,185,129,0.08)",  description: "Invite, deactivate, and assign roles to team members." },
  { to: "/admin/workflows",         title: "Workflows",         icon: Sliders,    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  description: "Define statuses, transitions, and approval gates." },
  { to: "/admin/custom-fields",     title: "Custom Fields",     icon: Tags,       color: "#2563EB", bg: "rgba(37,99,235,0.08)",   description: "Add department-specific metadata fields to tasks." },
  { to: "/admin/priorities",        title: "Priorities",        icon: Target,     color: "#ef4444", bg: "rgba(239,68,68,0.08)",   description: "Configure priority levels and their visual colors." },
  { to: "/admin/sla",               title: "SLA Policies",      icon: Clock,      color: "#f97316", bg: "rgba(249,115,22,0.08)",  description: "Set SLA response and resolution targets by priority." },
  { to: "/admin/holiday-calendars", title: "Holiday Calendars", icon: Calendar,   color: "#06b6d4", bg: "rgba(6,182,212,0.08)",   description: "Define country/state holiday calendars for SLA." },
  { to: "/admin/on-hold-reasons",   title: "On-Hold Reasons",   icon: PauseCircle,color: "#eab308", bg: "rgba(234,179,8,0.08)",   description: "Configure reason labels for on-hold status transitions." },
  { to: "/admin/scorecard-weights", title: "Scorecard Weights", icon: BarChart3,  color: "#14b8a6", bg: "rgba(20,184,166,0.08)",  description: "Adjust completion, on-time, and quality scoring weights." },
  { to: "/admin/integrations",      title: "Integrations",      icon: Plug,       color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  description: "Connect Slack, GitHub, JIRA, and other services." },
  { to: "/admin/settings",          title: "Org Settings",      icon: Settings,   color: "#6b7898", bg: "rgba(107,120,152,0.08)", description: "Set org name, logo, locale, and global defaults." },
];

export function AdminHomePage() {
  const { data: departments } = useDepartmentsAdmin();
  const { data: roles }       = useRoles();
  const { data: users }       = useUsersAdmin();
  const { data: permissions } = usePermissionKeys();
  const { data: workflows }   = useWorkflowsAdmin();
  const { data: slaPolicies } = useSLAPolicies();

  const activeUsers   = (users as any[] | undefined)?.filter((u: any) => u.is_active).length ?? 0;
  const deptCount     = departments?.length  ?? 0;
  const roleCount     = roles?.length        ?? 0;
  const permCount     = permissions?.length  ?? 0;
  const workflowCount = (workflows   as any[] | undefined)?.length ?? 0;
  const slaCount      = (slaPolicies as any[] | undefined)?.length ?? 0;

  const checklist = [
    { label: "Create Departments",  done: deptCount > 0,     to: "/admin/departments" },
    { label: "Set Up Roles",        done: roleCount > 0,     to: "/admin/roles" },
    { label: "Invite Team Members", done: activeUsers > 0,   to: "/admin/users" },
    { label: "Configure Workflows", done: workflowCount > 0, to: "/admin/workflows" },
    { label: "Set SLA Policies",    done: slaCount > 0,      to: "/admin/sla" },
  ];
  const completedCount = checklist.filter((c) => c.done).length;
  const isFullySetup   = completedCount === checklist.length;

  const quickStats = [
    { label: "Active Users",  value: activeUsers, to: "/admin/users",       color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
    { label: "Departments",   value: deptCount,   to: "/admin/departments", color: "#10b981", bg: "rgba(16,185,129,0.08)" },
    { label: "Roles",         value: roleCount,   to: "/admin/roles",       color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
    { label: "Permissions",   value: permCount,   to: "/admin/roles",       color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status banner */}
      <div className="neu-card" style={{ borderLeft: `4px solid ${isFullySetup ? "#10b981" : "#f59e0b"}` }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{ background: isFullySetup ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)" }}
            >
              {isFullySetup
                ? <Rocket className="w-5 h-5 text-emerald-500" />
                : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                {isFullySetup ? "Organisation Ready for Production" : "Setup Checklist"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {isFullySetup
                  ? "All core configurations are in place."
                  : `${completedCount} of ${checklist.length} steps completed`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {checklist.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                style={item.done
                  ? { background: "rgba(16,185,129,0.1)", color: "#10b981" }
                  : { background: "var(--neu-bg)", boxShadow: "3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)", color: "var(--text-muted)" }}
              >
                {item.done
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <Circle className="w-3.5 h-3.5" />}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {quickStats.map((s) => (
          <Link key={s.label} to={s.to} className="stat-card group">
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            <ChevronRight className="absolute top-4 right-4 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
          </Link>
        ))}
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.to}
              to={section.to}
              className="neu-card group flex items-start gap-4"
            >
              <div
                className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-transform group-hover:scale-105"
                style={{ background: section.bg, color: section.color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold transition-colors group-hover:text-gradient" style={{ color: "var(--text-primary)" }}>
                  {section.title}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {section.description}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: section.color }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
