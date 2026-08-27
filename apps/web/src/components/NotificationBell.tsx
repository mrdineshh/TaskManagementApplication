import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationType } from '@taskapp/shared-types';
import { apiClient } from '../lib/api-client/client';

const LABELS: Record<NotificationType, (p: Record<string, unknown>) => string> = {
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
};

function describe(n: Notification): string {
  const fn = LABELS[n.type];
  return fn ? fn(n.payload) : n.type.replace(/_/g, ' ');
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

/**
 * Notification bell (docs/10-OPEN-DECISIONS.md §M9) — replaces the standalone Notifications nav
 * page entirely; a notification isn't its own destination, it's a pointer into other pages.
 * Polls rather than pushing (no websocket/SSE infra in this app) — 30s is frequent enough for a
 * bell badge without hammering the API.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.notifications.list(),
    refetchInterval: 30_000,
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function markAllRead() {
    await apiClient.notifications.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await apiClient.notifications.markRead(n.id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    setOpen(false);
    const taskId = n.payload.taskId;
    if (typeof taskId === 'string') navigate(`/tasks/${taskId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n)}
                  className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-950 ${
                    n.is_read ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <span className="block">{describe(n)}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-400 dark:text-slate-500">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
            {notifications.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No notifications in the last 30 days.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
