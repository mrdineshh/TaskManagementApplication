import { z } from 'zod';
import type { ISODateString } from './common';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  department_id: string;
  workflow_id: string;
  status_id: string;
  priority_id: string;
  assignee_id: string | null;
  created_by_id: string;
  parent_task_id: string | null;
  due_date: ISODateString | null;
  start_date: ISODateString | null;
  completed_at: ISODateString | null;
  is_recurring: boolean; // v1.1
  recurrence_rule: string | null; // v1.1, iCal RRULE
  // Phase 2 (docs/10-OPEN-DECISIONS.md §H1/§H2)
  on_hold_reason_id: string | null;
  estimate_value: number | null;
  estimate_unit: 'hours' | 'days' | null;
  estimate_submitted_at: ISODateString | null;
  estimate_submitted_by_id: string | null;
  estimate_minutes?: number | null;
  // Time tracking & work-session timer
  timer_started_at?: ISODateString | null;
  total_logged_minutes?: number;
  timerStartedAt?: ISODateString | null;
  totalLoggedMinutes?: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface TaskWithDetails extends Task {
  custom_field_values: Record<string, unknown>;
  subtask_ids: string[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: ISODateString;
}

export interface ActivityLogEntry {
  id: string;
  task_id: string | null;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: ISODateString;
}

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  department_id: z.string().uuid(),
  workflow_id: z.string().uuid().optional(), // defaults to department's default workflow
  priority_id: z.string().uuid().optional(), // defaults to the department's default priority
  assignee_id: z.string().uuid().nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  start_date: z.string().datetime().nullable().optional(),
  custom_field_values: z.record(z.string(), z.unknown()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema
  .omit({ department_id: true, parent_task_id: true })
  .partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const assignTaskSchema = z.object({
  assignee_id: z.string().uuid().nullable(),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const transitionTaskSchema = z.object({
  to_status_id: z.string().uuid(),
});
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const taskFilterSchema = z.object({
  department_id: z.string().uuid().optional(),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().optional(),
  priority_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  q: z.string().optional(),
  sort: z.string().optional(), // e.g. "-due_date"
});
export type TaskFilterQuery = z.infer<typeof taskFilterSchema>;

/** Attachment size limit per 05-FEATURES.md §1.4 [Default: 25MB]. */
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

/** Admin-configurable, org-wide (docs/10-OPEN-DECISIONS.md §H1). */
export interface OnHoldReason {
  id: string;
  label: string;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export type TaskActionType = 'archive' | 'delete';
export type TaskActionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TaskActionRequest {
  id: string;
  task_id: string;
  action_type: TaskActionType;
  requester_id: string;
  requester?: {
    id: string;
    full_name: string;
    email: string;
  };
  reviewer_id: string | null;
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  status: TaskActionRequestStatus;
  reason: string | null;
  reviewer_note: string | null;
  created_at: ISODateString;
  decided_at: ISODateString | null;
  task?: {
    id: string;
    title: string;
    department_id: string;
    department?: { name: string };
    status?: { label: string; color: string | null };
  };
}

export const createTaskActionRequestSchema = z.object({
  action_type: z.enum(['archive', 'delete']),
  reason: z.string().max(2000).optional(),
});
export type CreateTaskActionRequestInput = z.infer<typeof createTaskActionRequestSchema>;

export const decideTaskActionRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewer_note: z.string().max(2000).optional(),
});
export type DecideTaskActionRequestInput = z.infer<typeof decideTaskActionRequestSchema>;

export type TaskReviewDecision = 'changes_requested' | 'approved';
export type TaskReviewStatus = 'active' | 'resolved';

export interface TaskReviewAttachment {
  id: string;
  review_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: ISODateString;
  download_url?: string;
}

export interface TaskReview {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
  };
  decision: TaskReviewDecision;
  feedback: string;
  status: TaskReviewStatus;
  created_at: ISODateString;
  resolved_at: ISODateString | null;
  attachments?: TaskReviewAttachment[];
}

export interface ReviewAttachmentUpload {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  content_base64: string;
}

export interface ReviewActionInput {
  action: TaskReviewDecision;
  comment?: string;
  attachments?: ReviewAttachmentUpload[];
}

