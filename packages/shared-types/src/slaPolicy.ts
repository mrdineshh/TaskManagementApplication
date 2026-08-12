import { z } from 'zod';
import type { ISODateString } from './common';

export const escalationNotifyTargets = ['assignee', 'assignee_manager'] as const;
export type EscalationNotifyTarget = (typeof escalationNotifyTargets)[number];

export const escalationRuleSchema = z.object({
  percent_elapsed: z.number().min(1).max(200),
  notify: z.enum(escalationNotifyTargets),
});
export type EscalationRule = z.infer<typeof escalationRuleSchema>;

export interface SLAPolicy {
  id: string;
  name: string;
  department_id: string | null;
  response_time_minutes: number;
  resolution_time_minutes: number;
  escalation_rules: EscalationRule[];
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export const createSLAPolicySchema = z.object({
  name: z.string().min(1).max(200),
  department_id: z.string().uuid().nullable().default(null),
  response_time_minutes: z.number().int().min(1),
  resolution_time_minutes: z.number().int().min(1),
  escalation_rules: z.array(escalationRuleSchema).default([]),
});
export type CreateSLAPolicyInput = z.infer<typeof createSLAPolicySchema>;

export const updateSLAPolicySchema = createSLAPolicySchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type UpdateSLAPolicyInput = z.infer<typeof updateSLAPolicySchema>;

/** Default starter escalation rules seeded when a policy is created without any specified. */
export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  { percent_elapsed: 80, notify: 'assignee' },
  { percent_elapsed: 100, notify: 'assignee_manager' },
];
