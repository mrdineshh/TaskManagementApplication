import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@taskapp/shared-types';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { apiClient } from '../lib/api-client/client';
import { useSessionStore } from '../lib/auth/session-store';
import { showDesktopNotification } from '../lib/notifications/desktop-notifications';

const LABELS: Record<string, (p: Record<string, unknown>) => string> = {
  task_assigned: (p) => `Task assigned to you: ${p.taskTitle ?? 'a task'}`,
  task_reassigned: (p) => `Task reassigned: ${p.taskTitle ?? 'a task'}`,
  due_soon: (p) => `Due soon: ${p.taskTitle ?? 'a task'}`,
  task_overdue: (p) => `Overdue: ${p.taskTitle ?? 'a task'}`,
  comment_mention: (p) => `You were mentioned on: ${p.taskTitle ?? 'a task'}`,
  status_changed: (p) => `Status changed on: ${p.taskTitle ?? 'a task'}`,
  sla_breach: (p) => `SLA breached: ${p.taskTitle ?? 'a task'}`,
  approval_requested: (p) => `Approval requested: ${p.taskTitle ?? 'a task'}`,
  task_on_hold: (p) => `Task put on hold: ${p.taskTitle ?? 'a task'}`,
  effort_budget_exceeded: (p) => `Over time estimate: ${p.taskTitle ?? 'a task'}`,
  task_submitted_for_review: (p) => `Task submitted for review: ${p.taskTitle ?? 'a task'}${p.assigneeName ? ` by ${p.assigneeName}` : ''}`,
  review_changes_requested: (p) => `Changes requested: ${p.taskTitle ?? 'a task'}${p.reviewerName ? ` by ${p.reviewerName}` : ''}`,
  task_approved: (p) => `Task approved (Marked Done): ${p.taskTitle ?? 'a task'}`,
  task_action_requested: (p) => `Request to ${p.actionType ?? 'update'}: ${p.taskTitle ?? 'a task'}`,
  task_action_decided: (p) => `Task ${p.actionType ?? 'action'} ${p.decision ?? 'decided'}: ${p.taskTitle ?? 'a task'}`,
  timer_auto_stopped: (p) => `Work timer auto-stopped: ${p.taskTitle ?? 'a task'} (exceeded ${p.maxHours ?? 10}h limit)`,
  role_assigned: (p) => `Your role was updated to ${p.roleName ?? 'a new role'}${p.departmentName ? ` in ${p.departmentName}` : ''} - please refresh`,
  role_revoked: (p) => `Your ${p.roleName ?? ''} role was removed - please refresh`,
  manager_assigned: (p) => `Your new manager is ${p.managerName ?? 'a team lead'}`,
};

function describe(n: Notification): string {
  const fn = LABELS[n.type];
  return fn ? fn(n.payload ?? {}) : (n.type ? n.type.replace(/_/g, ' ') : 'Notification');
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/* ── In-app toast notification ─────────────────────────────────────────────── */
interface ToastNotif {
  id: string;
  message: string;
  taskId?: string;
}

let toastQueue: ToastNotif[] = [];
let toastListeners: Array<(q: ToastNotif[]) => void> = [];

function pushToast(t: ToastNotif) {
  toastQueue = [t, ...toastQueue].slice(0, 3);
  toastListeners.forEach((fn) => fn([...toastQueue]));
  setTimeout(() => {
    toastQueue = toastQueue.filter((x) => x.id !== t.id);
    toastListeners.forEach((fn) => fn([...toastQueue]));
  }, 6000);
}

function dismissToast(id: string) {
  toastQueue = toastQueue.filter((x) => x.id !== id);
  toastListeners.forEach((fn) => fn([...toastQueue]));
}

/** Floating notification toasts — rendered at app root level */
export function NotificationToasts() {
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    toastListeners.push(setToasts);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: "22rem" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto animate-pop-in flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "var(--neu-bg)",
            boxShadow: "8px 8px 24px var(--neu-dark), -4px -4px 12px var(--neu-light), 0 0 0 1px rgba(37,99,235,0.1)",
            maxWidth: "22rem",
          }}
        >
          {/* Bell icon */}
          <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border-2 border-blue-600 bg-white dark:bg-slate-900 text-blue-600 shadow-neu-sm">
            <Bell className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{t.message}</p>
            {t.taskId && (
              <button
                onClick={() => { navigate(`/tasks/${t.taskId}`); dismissToast(t.id); qc.invalidateQueries({ queryKey: ['notifications'] }); }}
                className="mt-1 text-xs font-medium hover:underline"
                style={{ color: "#2563EB" }}
              >
                View task →
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => dismissToast(t.id)}
              className="nav-icon-btn !w-6 !h-6 !rounded-lg"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Notification bell — polls every 30s, shows in-app toast for new notifications.
 * Does NOT auto-request browser notification permission (that's in NotificationPermissionBanner).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [roleChangePending, setRoleChangePending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useSessionStore((s) => s.currentUser);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.notifications.list(),
    refetchInterval: 30_000,
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    // NOTE: Do NOT auto-request desktop permission here — that's in NotificationPermissionBanner
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!initialLoadDoneRef.current) {
      data.forEach((n) => seenIdsRef.current.add(n.id));
      initialLoadDoneRef.current = true;
      return;
    }

    const newUnread = data.filter((n) => !n.is_read && !seenIdsRef.current.has(n.id));
    newUnread.forEach((n) => {
      seenIdsRef.current.add(n.id);

      const msg = describe(n);
      const taskId = typeof n.payload?.taskId === 'string' ? n.payload.taskId : undefined;

      // Show in-app toast
      pushToast({ id: n.id, message: msg, taskId });

      // Also show desktop notification if permission already granted (user opted in earlier)
      if (Notification.permission === 'granted') {
        void showDesktopNotification(`Pulse: ${msg}`, { body: msg, taskId });
      }

      if (currentUser && (n.type === 'role_assigned' || n.type === 'role_revoked')) {
        setRoleChangePending(true);
      }
      if ([
        'task_assigned',
        'task_reassigned',
        'status_changed',
        'approval_requested',
        'task_submitted_for_review',
        'review_changes_requested',
        'task_approved',
        'effort_budget_exceeded',
        'task_action_requested',
        'task_action_decided',
      ].includes(n.type)) {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['dashboards'] });
      }
    });
  }, [data, currentUser]);

  async function markAllRead() {
    await apiClient.notifications.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function markOneRead(n: Notification) {
    if (!n.is_read) {
      await apiClient.notifications.markRead(n.id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    setOpen(false);
    const taskId = n.payload?.taskId;
    if (typeof taskId === 'string') navigate(`/tasks/${taskId}`);
  }

  return (
    <div ref={ref} className="relative">
      {/* Role-change banner */}
      {roleChangePending && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-2xl px-4 py-3 animate-pop-in" style={{ maxWidth: '22rem', width: 'calc(100vw - 2rem)', background: "var(--neu-bg)", boxShadow: "8px 8px 24px var(--neu-dark), -4px -4px 12px var(--neu-light), 0 0 0 1px rgba(245,158,11,0.3)" }}>
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border-2 border-amber-500 bg-white dark:bg-slate-900 text-amber-600 shadow-neu-sm">
            <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Your permissions changed</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sign out and back in to apply your new role.</p>
          </div>
          <button onClick={() => window.location.reload()} className="btn-primary !py-1.5 !px-3 !text-xs shrink-0">Refresh</button>
        </div>
      )}

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="nav-icon-btn relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-2 border-red-600 px-1 shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl overflow-hidden animate-pop-in" style={{ background: "var(--neu-bg)", boxShadow: "8px 8px 24px var(--neu-dark), -4px -4px 12px var(--neu-light)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--neu-dark)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "#2563EB" }}>
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} style={{ borderBottom: "1px solid var(--neu-dark)" }}>
                <div className={`flex items-start gap-2 px-4 py-3 hover:bg-[rgba(37,99,235,0.04)] transition-colors ${!n.is_read ? '' : 'opacity-60'}`}>
                  {/* Unread dot */}
                  <div className="shrink-0 mt-1.5">
                    {!n.is_read ? (
                      <span className="block w-2 h-2 rounded-full" style={{ background: "#2563EB" }} />
                    ) : (
                      <span className="block w-2 h-2 rounded-full" style={{ background: "var(--neu-dark)" }} />
                    )}
                  </div>

                  {/* Text */}
                  <button onClick={() => markOneRead(n)} className="flex-1 text-left min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold' : ''}`} style={{ color: "var(--text-primary)" }}>{describe(n)}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{timeAgo(n.created_at)}</p>
                  </button>

                  {/* Mark as read individually */}
                  {!n.is_read && (
                    <button
                      onClick={async () => { await apiClient.notifications.markRead(n.id); qc.invalidateQueries({ queryKey: ['notifications'] }); }}
                      className="shrink-0 mt-0.5 nav-icon-btn !w-6 !h-6 !rounded-md"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No notifications in the last 30 days.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
