import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, AtSign, Bell, CheckCircle2, Clock,
  PauseCircle, RefreshCw, RotateCcw, ShieldCheck, Timer, UserPlus, CheckCheck,
} from "lucide-react";
import type { Notification, NotificationType } from "@taskapp/shared-types";
import { apiClient } from "../../lib/api-client/client";

const LABELS: Record<NotificationType, (p: Record<string, unknown>) => string> = {
  task_assigned:             (p) => `Task assigned to you: ${p.taskTitle ?? "a task"}`,
  task_reassigned:           (p) => `Task reassigned: ${p.taskTitle ?? "a task"}`,
  due_soon:                  (p) => `Due soon: ${p.taskTitle ?? "a task"}`,
  task_overdue:              (p) => `Overdue: ${p.taskTitle ?? "a task"}`,
  comment_mention:           (p) => `You were mentioned on: ${p.taskTitle ?? "a task"}`,
  status_changed:            (p) => `Status changed on: ${p.taskTitle ?? "a task"}`,
  sla_breach:                (p) => `SLA breached: ${p.taskTitle ?? "a task"}`,
  approval_requested:        (p) => `Approval requested: ${p.taskTitle ?? "a task"}`,
  task_on_hold:              (p) => `Task put on hold: ${p.taskTitle ?? "a task"}`,
  effort_budget_exceeded:    (p) => `Over time estimate: ${p.taskTitle ?? "a task"}`,
  task_submitted_for_review: (p) => `Submitted for review: ${p.taskTitle ?? "a task"}${p.assigneeName ? ` by ${p.assigneeName}` : ""}`,
  review_changes_requested:  (p) => `Changes requested: ${p.taskTitle ?? "a task"}${p.reviewerName ? ` by ${p.reviewerName}` : ""}`,
  task_approved:             (p) => `Task approved: ${p.taskTitle ?? "a task"}`,
  task_action_requested:     (p) => `Request to ${p.actionType ?? "update"}: ${p.taskTitle ?? "a task"}`,
  task_action_decided:       (p) => `Task ${p.actionType ?? "action"} ${p.decision ?? "decided"}: ${p.taskTitle ?? "a task"}`,
  timer_auto_stopped:        (p) => `Work timer auto-stopped: ${p.taskTitle ?? "a task"} (${p.loggedMinutes ?? 0}min logged)`,
  role_assigned:             (p) => `Role updated: You are now a ${p.roleName ?? "team member"}${p.departmentName ? ` in ${p.departmentName}` : ""} � refresh to apply`,
  role_revoked:              (p) => `Your ${p.roleName ?? ""} role was removed � refresh to apply`,
  manager_assigned:          (p) => `Your new manager is ${p.managerName ?? "a team lead"}`,
};

const ICON_MAP: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  task_assigned:             { icon: UserPlus,    color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
  task_reassigned:           { icon: RefreshCw,   color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  due_soon:                  { icon: Clock,        color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  task_overdue:              { icon: AlertCircle,  color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  comment_mention:           { icon: AtSign,       color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  status_changed:            { icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  sla_breach:                { icon: AlertTriangle,color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  approval_requested:        { icon: ShieldCheck,  color: "#7c3aed", bg: "rgba(124,58,237,0.1)"  },
  task_on_hold:              { icon: PauseCircle,  color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  effort_budget_exceeded:    { icon: Timer,        color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  task_submitted_for_review: { icon: Clock,        color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  review_changes_requested:  { icon: RotateCcw,   color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  task_approved:             { icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  task_action_requested:     { icon: AlertCircle,  color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  task_action_decided:       { icon: ShieldCheck,  color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
  timer_auto_stopped:        { icon: Timer,        color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  role_assigned:             { icon: ShieldCheck,  color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  role_revoked:              { icon: AlertTriangle,color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  manager_assigned:          { icon: UserPlus,     color: "#14b8a6", bg: "rgba(20,184,166,0.1)"  },
};

function describe(n: Notification): string {
  const fn = LABELS[n.type];
  return fn ? fn(n.payload) : n.type.replace(/_/g, " ");
}
function timeAgo(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.notifications.list(),
    refetchInterval: 30_000,
  });

  const notifications = data ?? [];
  const unreadCount   = notifications.filter((n) => !n.is_read).length;
  const visible       = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  async function markAllRead() {
    await apiClient.notifications.markAllRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await apiClient.notifications.markRead(n.id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    const taskId = n.payload.taskId;
    if (typeof taskId === "string") navigate(`/tasks/${taskId}`);
  }

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-box-brand">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{unreadCount} unread</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-xs gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          {/* Filter toggle */}
          <div className="neu-card !p-1 !rounded-xl flex gap-1 bg-white/50 dark:bg-slate-900/50">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="relative rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all"
                style={filter === f
                  ? { background: "#ffffff", border: "2px solid #2563EB", color: "#0f172a", boxShadow: "0 2px 8px rgba(37,99,235,0.15)" }
                  : { border: "2px solid transparent", color: "var(--text-muted)" }}
              >
                {f}
                {f === "unread" && unreadCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold bg-white text-slate-900 shadow-xs"
                    style={{ border: "2px solid #ef4444" }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl skeleton" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && visible.length === 0 && (
        <div className="neu-card flex flex-col items-center py-16 text-center">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4 animate-float"
            style={{ background: "var(--neu-bg)", boxShadow: "6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)" }}
          >
            <Bell className="w-7 h-7" style={{ color: "var(--text-faint)" }} />
          </div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {filter === "unread" ? "All caught up!" : "No notifications"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {filter === "unread" ? "No unread notifications." : "Nothing in the last 30 days."}
          </p>
        </div>
      )}

      {/* List */}
      {visible.length > 0 && (
        <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
          <ul className="divide-y" style={{ "--tw-divide-opacity": 1 } as any}>
            {visible.map((n) => {
              const meta = ICON_MAP[n.type] ?? { icon: Bell, color: "#8e9ab5", bg: "rgba(142,154,181,0.1)" };
              const Icon = meta.icon;
              return (
                <li key={n.id} style={{ borderColor: "rgba(0,0,0,0.05)", background: n.is_read ? undefined : "rgba(37,99,235,0.025)" }}>
                  <button
                    onClick={() => handleClick(n)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition-all hover:bg-[rgba(37,99,235,0.03)]"
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 shadow-2xs"
                      style={{ border: `2px solid ${meta.color}`, color: meta.color }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm"
                        style={{ color: n.is_read ? "var(--text-muted)" : "var(--text-primary)", fontWeight: n.is_read ? 400 : 600 }}
                      >
                        {describe(n)}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-white" style={{ border: "2px solid #2563EB" }} aria-label="Unread" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
