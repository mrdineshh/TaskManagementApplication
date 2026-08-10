import { z } from 'zod';
import type { ISODateString } from './common';

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase, alphanumeric, and dashes only'),
  description: z.string().max(500).optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

/** Seed set per 00-OVERVIEW.md §2 — admin-editable post-launch, not hardcoded logic. */
export const SEED_DEPARTMENT_SLUGS = [
  'development',
  'hr-admin',
  'sales',
  'pre-sales',
  'customer-support',
  'finance-revenue',
  'management',
  'field-sales-representatives',
  'inside-sales-representatives',
  'marketing',
] as const;
