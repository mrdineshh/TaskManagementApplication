import { z } from 'zod';
import { workflowStatusCategories, type WorkflowStatusCategory } from './common';

export interface WorkflowDefinition {
  id: string;
  name: string;
  department_id: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface WorkflowStatus {
  id: string;
  workflow_id: string;
  key: string;
  label: string;
  category: WorkflowStatusCategory;
  display_order: number;
  color: string | null;
  /** Whether transitioning into this status requires picking an OnHoldReason
   * (docs/10-OPEN-DECISIONS.md §H1) — admin-configurable per status, not tied to any specific key. */
  requires_hold_reason: boolean;
  /** Whether transitioning into this status requires the task to already have an effort
   * estimate (§H2) — the one status representing genuinely starting work, not every status
   * sharing the in_progress category (On Hold/Blocked/In Review are also in_progress but
   * shouldn't demand one). */
  requires_estimate_before_entry: boolean;
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_status_id: string;
  to_status_id: string;
  required_permission: string | null;
  requires_approval: boolean; // v1.1
}

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  department_id: z.string().uuid().nullable().default(null),
  is_default: z.boolean().default(false),
});
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const createWorkflowStatusSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'key must be lowercase snake_case'),
  label: z.string().min(1).max(100),
  category: z.enum(workflowStatusCategories),
  display_order: z.number().int().min(0),
  color: z.string().max(20).optional(),
  requires_hold_reason: z.boolean().default(false),
  requires_estimate_before_entry: z.boolean().default(false),
});
export type CreateWorkflowStatusInput = z.infer<typeof createWorkflowStatusSchema>;

export const updateWorkflowStatusSchema = createWorkflowStatusSchema.partial();
export type UpdateWorkflowStatusInput = z.infer<typeof updateWorkflowStatusSchema>;

export const createWorkflowTransitionSchema = z.object({
  from_status_id: z.string().uuid(),
  to_status_id: z.string().uuid(),
  required_permission: z.string().nullable().optional(),
  requires_approval: z.boolean().default(false),
});
export type CreateWorkflowTransitionInput = z.infer<typeof createWorkflowTransitionSchema>;

/** Starter statuses seeded per 02-DATA-MODEL.md §2.5a. */
export const SEED_WORKFLOW_STATUSES: CreateWorkflowStatusInput[] = [
  {
    key: 'todo',
    label: 'Todo',
    category: 'todo',
    display_order: 0,
    color: '#94a3b8',
    requires_hold_reason: false,
    requires_estimate_before_entry: false,
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    category: 'in_progress',
    display_order: 1,
    color: '#3b82f6',
    requires_hold_reason: false,
    // The one status meaning "work genuinely started" (docs/10-OPEN-DECISIONS.md §H2) — every
    // other in_progress-category status (In Review, Blocked, On Hold) leaves this false.
    requires_estimate_before_entry: true,
  },
  {
    key: 'in_review',
    label: 'In Review',
    category: 'in_progress',
    display_order: 2,
    color: '#f59e0b',
    requires_hold_reason: false,
    requires_estimate_before_entry: false,
  },
  {
    key: 'blocked',
    label: 'Blocked',
    category: 'in_progress',
    display_order: 3,
    color: '#ef4444',
    requires_hold_reason: false,
    requires_estimate_before_entry: false,
  },
  // Distinct from "Blocked" above — On Hold specifically means waiting on something *external*
  // (customer, third party) with an admin-configurable reason attached (docs/10-OPEN-DECISIONS.md
  // §H1), whereas Blocked has no such reason-tracking. requires_hold_reason is what actually
  // enforces the reason requirement; the "on_hold" key itself has no special meaning to the code.
  {
    key: 'on_hold',
    label: 'On Hold',
    category: 'in_progress',
    display_order: 4,
    color: '#a855f7',
    requires_hold_reason: true,
    requires_estimate_before_entry: false,
  },
  {
    key: 'done',
    label: 'Done',
    category: 'done',
    display_order: 5,
    color: '#22c55e',
    requires_hold_reason: false,
    requires_estimate_before_entry: false,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    category: 'cancelled',
    display_order: 6,
    color: '#64748b',
    requires_hold_reason: false,
    requires_estimate_before_entry: false,
  },
];
