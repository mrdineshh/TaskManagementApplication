import { NavLink, Outlet, Navigate } from "react-router-dom";
import {
  LayoutGrid, Building2, Shield, Users, Sliders, Target,
  Clock, BarChart3, Plug, Bug,
} from "lucide-react";
import { usePermission } from "../../lib/permissions/usePermission";
import { useSessionStore } from "../../lib/auth/session-store";

const sections = [
  { to: "",                   label: "Overview",            icon: LayoutGrid,   end: true },
  { to: "departments",        label: "Departments",         icon: Building2 },
  { to: "roles",              label: "Roles & Permissions", icon: Shield },
  { to: "users",              label: "Users",               icon: Users },
  { to: "workflows",          label: "Workflows",           icon: Sliders },
  { to: "priorities",         label: "Priorities & Fields", icon: Target },
  { to: "sla",                label: "SLA Policies",        icon: Clock },
  { to: "scorecard-weights",  label: "Scorecard Weights",   icon: BarChart3 },
  { to: "integrations",       label: "Integrations",        icon: Plug },
  { to: "bug-reports",        label: "Bug Reports",         icon: Bug },
];

/** Neumorphic Admin area layout with scrollable left sidebar sub-navigation. */
export function AdminLayout() {
  const canAdmin = usePermission('department.manage');
  const bootstrapped = useSessionStore((s) => s.bootstrapped);

  // Wait for session to load before making access decisions.
  if (!bootstrapped) return null;
  // Frontend UX guard — non-admins get sent home (backend enforces 403 anyway).
  if (!canAdmin) return <Navigate to="/" replace />;

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Admin Console</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Manage your organisation settings, users, and workflows
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Admin Navigation Sidebar — sticky, independently scrollable */}
        <nav
          className="w-56 shrink-0 neu-card !p-2 space-y-0.5 sticky top-0 overflow-y-auto"
          style={{
            maxHeight: "calc(100vh - 7rem)",
            overscrollBehavior: "contain",
          }}
          aria-label="Admin Navigation"
        >
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "font-semibold"
                      : "hover:bg-[rgba(37,99,235,0.06)]"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: "#ffffff",
                        border: "2px solid #2563EB",
                        color: "#0f172a",
                        boxShadow: "0 2px 6px rgba(37,99,235,0.12)",
                      }
                    : { color: "var(--text-muted)", border: "2px solid transparent" }
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600" : ""}`} />
                    <span className="truncate">{s.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0 animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
