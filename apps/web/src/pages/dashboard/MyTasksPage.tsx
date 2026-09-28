import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Play, LogOut, AlertTriangle, TrendingUp, Calendar, Zap, ChevronRight } from "lucide-react";
import { usePersonalDashboard, useClockIn, useClockOut } from "../../features/tasks/hooks";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { WorkSessionTimer } from "../../features/tasks/WorkSessionTimer";
import { useSessionStore } from "../../lib/auth/session-store";
import { fmtDate } from "../../lib/utils/dates";
import { NotificationPermissionBanner } from "../../components/NotificationPermissionBanner";

function TaskTimerActionButton({ taskId, isRunning }: { taskId: string; isRunning: boolean }) {
  const clockIn  = useClockIn(taskId);
  const clockOut = useClockOut(taskId);
  const pending  = clockIn.isPending || clockOut.isPending;

  return isRunning ? (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clockOut.mutate(); }}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-all"
      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 12px rgba(245,158,11,0.35)" }}
    >
      <LogOut className="w-3 h-3" />
      {clockOut.isPending ? "â€¦" : "Clock Out"}
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clockIn.mutate(); }}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-all"
      style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 12px rgba(16,185,129,0.35)" }}
    >
      <Play className="w-3 h-3 fill-current" />
      {clockIn.isPending ? "â€¦" : "Clock In"}
    </button>
  );
}

/** My Tasks â€” personal dashboard with neumorphic stat cards and task list. */
export function MyTasksPage() {
  const { data, isLoading, isError } = usePersonalDashboard();
  const currentUser = useSessionStore((s) => s.currentUser);
  const myId = currentUser?.id;

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-2xl skeleton" />
    </div>
  );

  if (isError) return (
    <div
      className="rounded-2xl px-6 py-8 text-center"
      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
    >
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="font-semibold text-red-600">Failed to load tasks</p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Check your connection and try refreshing.</p>
    </div>
  );

  const d = (data ?? {}) as any;
  const openTasks         = Array.isArray(d.open_tasks)         ? d.open_tasks         : [];
  const recentlyCompleted = Array.isArray(d.recently_completed) ? d.recently_completed : [];
  const activeTask        = openTasks.find((t: any) => Boolean(t.timerStartedAt ?? t.timer_started_at));

  const stats = [
    { label: "Overdue",      value: d.overdue_count       ?? 0, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.08)",   href: `/tasks?assignee_id=${myId}&overdue=true` },
    { label: "Over Budget",  value: d.over_budget_count   ?? 0, icon: TrendingUp,    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  href: `/tasks?assignee_id=${myId}&over_budget=true` },
    { label: "Due This Week",value: d.due_this_week_count ?? 0, icon: Calendar,      color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  href: `/tasks?assignee_id=${myId}&due_this_week=true` },
    { label: "Open Tasks",   value: openTasks.length,           icon: Zap,           color: "#2563EB", bg: "rgba(37,99,235,0.08)",   href: `/tasks?assignee_id=${myId}` },
  ];

  // Expose user ID for push registration from banner
  if (currentUser?.id) (window as any).__pulseUserId = currentUser.id;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Notification opt-in banner â€” only shown once if permission is 'default' */}
      <NotificationPermissionBanner />

      {/* Page header */}
      <div>
        <h1 className="text-2xl">My Tasks</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Welcome back, {currentUser?.full_name?.split(" ")[0] ?? "there"} ðŸ‘‹
        </p>
      </div>

      {/* Active work session */}
      {activeTask && (
        <div
          className="rounded-2xl p-5 animate-pop-in"
          style={{
            background: "var(--neu-bg)",
            boxShadow: "8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)",
            borderLeft: "4px solid #10b981",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Active Work Session</span>
              </div>
              <Link to={`/tasks/${activeTask.id}`} className="text-base font-bold hover:text-gradient transition-colors" style={{ color: "var(--text-primary)" }}>
                {activeTask.title}
              </Link>
              <div className="flex items-center gap-2">
                {activeTask.status && <Badge label={activeTask.status.label} color={activeTask.status.color} />}
                {activeTask.department?.name && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{activeTask.department.name}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:w-72">
              <WorkSessionTimer
                timerStartedAt={activeTask.timerStartedAt ?? activeTask.timer_started_at ?? null}
                totalLoggedMinutes={activeTask.totalLoggedMinutes ?? activeTask.total_logged_minutes ?? 0}
                size="full"
              />
              <div className="flex justify-end">
                <TaskTimerActionButton taskId={activeTask.id} isRunning={true} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.href} className="stat-card group">
              <div className="flex items-start justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                  style={{ background: s.bg, color: s.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-500 mt-0.5" style={{ color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Open tasks */}
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <h2 className="text-base" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700 }}>Open Tasks</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>
            {openTasks.length}
          </span>
        </div>
        <ul className="divide-y" style={{ "--tw-divide-opacity": 1 } as any}>
          {openTasks.map((t: any) => {
            const hasTimer   = Boolean(t.timerStartedAt ?? t.timer_started_at);
            const loggedMins = t.totalLoggedMinutes ?? t.total_logged_minutes ?? 0;
            const dueDate    = t.dueDate ?? t.due_date;
            const isInProgress = t.status?.category === "in_progress";
            return (
              <li
                key={t.id}
                className="flex items-center justify-between px-5 py-3.5 transition-all hover:bg-[rgba(37,99,235,0.03)]"
                style={{ borderColor: "rgba(0,0,0,0.05)" }}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <Link
                    to={`/tasks/${t.id}`}
                    className="text-sm font-semibold hover:text-gradient transition-colors break-words leading-snug block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t.title}
                  </Link>
                  {dueDate && (
                    <span className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "var(--text-faint)" }}>
                      <Clock className="w-3 h-3" /> Due {fmtDate(dueDate)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isInProgress && <TaskTimerActionButton taskId={t.id} isRunning={hasTimer} />}
                  {(hasTimer || loggedMins > 0) && (
                    <WorkSessionTimer
                      timerStartedAt={t.timerStartedAt ?? t.timer_started_at ?? null}
                      totalLoggedMinutes={loggedMins}
                      size="chip"
                    />
                  )}
                  {t.status && <Badge label={t.status.label} color={t.status.color} />}
                </div>
              </li>
            );
          })}
          {openTasks.length === 0 && data !== undefined && (
            <li>
              <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                title="All caught up!"
                subtitle="No open tasks right now. Head to All Tasks to find new work."
                linkAction={{ label: "Browse all tasks", href: "/tasks" }}
              />
            </li>
          )}
        </ul>
      </div>

      {/* Recently completed */}
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <h2 className="text-base" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700 }}>Recently Completed</h2>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <ul className="divide-y" style={{ "--tw-divide-opacity": 1 } as any}>
          {recentlyCompleted.map((t: any) => (
            <li
              key={t.id}
              className="px-5 py-3 transition-all hover:bg-[rgba(16,185,129,0.03)]"
              style={{ borderColor: "rgba(0,0,0,0.05)" }}
            >
              <Link
                to={`/tasks/${t.id}`}
                className="text-sm font-medium hover:underline flex items-center gap-2"
                style={{ color: "var(--text-muted)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="break-words leading-snug">{t.title}</span>
              </Link>
            </li>
          ))}
          {recentlyCompleted.length === 0 && (
            <li className="px-5 py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>None yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
