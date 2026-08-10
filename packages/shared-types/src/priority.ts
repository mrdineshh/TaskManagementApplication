import { z } from 'zod';

export interface PriorityDefinition {
  id: string;
  department_id: string | null;
  key: string;
  label: string;
  display_order: number;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

export const createPrioritySchema = z.object({
  department_id: z.string().uuid().nullable().default(null),
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'key must be lowercase snake_case'),
  label: z.string().min(1).max(100),
  display_order: z.number().int().min(0),
  color: z.string().max(20).optional(),
  is_default: z.boolean().default(false),
});
export type CreatePriorityInput = z.infer<typeof createPrioritySchema>;

export const updatePrioritySchema = createPrioritySchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;

/** Starter set seeded org-wide per 02-DATA-MODEL.md §2.5b. */
export const SEED_PRIORITIES: CreatePriorityInput[] = [
  { key: 'low', label: 'Low', display_order: 0, color: '#94a3b8', is_default: false, department_id: null },
  {
    key: 'medium',
    label: 'Medium',
    display_order: 1,
    color: '#3b82f6',
    is_default: true,
    department_id: null,
  },
  { key: 'high', label: 'High', display_order: 2, color: '#f59e0b', is_default: false, department_id: null },
  {
    key: 'urgent',
    label: 'Urgent',
    display_order: 3,
    color: '#ef4444',
    is_default: false,
    department_id: null,
  },
];
