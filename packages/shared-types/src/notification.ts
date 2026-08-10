import type { ISODateString } from './common';

export const notificationTypes = [
  'task_assigned',
  'task_reassigned',
  'due_soon',
  'task_overdue',
  'comment_mention',
  'status_changed',
  'sla_breach', // v1.1
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
