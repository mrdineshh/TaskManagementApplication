import { z } from 'zod';

/** ISO-8601 UTC timestamp string, as returned by the API. */
export type ISODateString = string;

export interface PaginatedResult<T> {
  items: T[];
  next_cursor: string | null;
}

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Meta-categories every WorkflowStatus maps to, per 02-DATA-MODEL.md §2.5a. */
export const workflowStatusCategories = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type WorkflowStatusCategory = (typeof workflowStatusCategories)[number];
