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
  { key: 'todo', label: 'Todo', category: 'todo', display_order: 0, color: '#94a3b8' },
  {
    key: 'in_progress',
    label: 'In Progress',
    category: 'in_progress',
    display_order: 1,
    color: '#3b82f6',
  },
  {
    key: 'in_review',
    label: 'In Review',
    category: 'in_progress',
    display_order: 2,
    color: '#f59e0b',
  },
  { key: 'blocked', label: 'Blocked', category: 'in_progress', display_order: 3, color: '#ef4444' },
  { key: 'done', label: 'Done', category: 'done', display_order: 4, color: '#22c55e' },
  {
    key: 'cancelled',
    label: 'Cancelled',
    category: 'cancelled',
    display_order: 5,
    color: '#64748b',
  },
];
