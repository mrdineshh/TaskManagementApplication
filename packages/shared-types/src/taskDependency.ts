import { z } from 'zod';
import type { ISODateString } from './common';

export const taskDependencyTypes = ['blocks', 'relates_to'] as const;
export type TaskDependencyType = (typeof taskDependencyTypes)[number];

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  type: TaskDependencyType;
  created_at: ISODateString;
}

export const createTaskDependencySchema = z.object({
  depends_on_task_id: z.string().uuid(),
  type: z.enum(taskDependencyTypes),
});
export type CreateTaskDependencyInput = z.infer<typeof createTaskDependencySchema>;

/**
 * Confirmed: soft warning, not a hard block (docs/10-OPEN-DECISIONS.md B2). A transition to a
 * 'done'-category status succeeds even with open 'blocks' dependencies; the API surfaces a
 * warning in the response for the UI to display rather than rejecting the request.
 */
export interface OpenBlockerWarning {
  task_id: string;
  task_title: string;
}
