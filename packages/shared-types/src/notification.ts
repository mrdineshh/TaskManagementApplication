import type { ISODateString } from './common';

export const notificationTypes = [
  'task_assigned',
  'task_reassigned',
  'due_soon',
  'task_overdue',
  'comment_mention',
  'status_changed',
  'sla_breach', // v1.1
  'approval_requested', // v1.1
  'task_on_hold', // Phase 2, docs/10-OPEN-DECISIONS.md §H1 — notifies the task creator
  'effort_budget_exceeded', // Phase 2, §H3 — notifies the assignee when logged hours pass the estimate
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const notificationChannels = ['in_app', 'email', 'push', 'slack'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  channel: NotificationChannel;
  is_read: boolean;
  sent_at: ISODateString | null;
  created_at: ISODateString;
}

/** Default: task due-soon notification fires this many hours before due_date (05-FEATURES.md §1.5). */
export const DEFAULT_DUE_SOON_HOURS = 24;

/** Per-event, per-channel opt-out (05-FEATURES.md §1.5). Absence of a stored override means enabled. */
export interface NotificationPreference {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}
