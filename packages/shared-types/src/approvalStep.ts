import { z } from 'zod';
import type { ISODateString } from './common';

export const approvalStepStatuses = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStepStatus = (typeof approvalStepStatuses)[number];

export interface ApprovalStep {
  id: string;
  task_id: string;
  transition_id: string;
  approver_id: string | null;
  status: ApprovalStepStatus;
  step_order: number;
  comment: string | null;
  decided_at: ISODateString | null;
  created_at: ISODateString;
}

export const decideApprovalStepSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional(),
});
export type DecideApprovalStepInput = z.infer<typeof decideApprovalStepSchema>;
