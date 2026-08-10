import { z } from 'zod';
import type { ISODateString } from './common';

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  minutes: number;
  note: string | null;
  logged_at: ISODateString;
}

export const createTimeLogSchema = z.object({
  minutes: z.number().int().min(1),
  note: z.string().max(1000).optional(),
  logged_at: z.string().datetime().optional(), // defaults to now if omitted
});
export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;
