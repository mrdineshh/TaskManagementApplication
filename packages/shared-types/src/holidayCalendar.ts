import { z } from 'zod';
import type { ISODateString } from './common';

/**
 * Admin-configurable per Country+State (docs/10-OPEN-DECISIONS.md §G2), driving business-day
 * due-date/overdue math for every User whose work_country/work_state matches.
 */
export interface HolidayCalendar {
  id: string;
  country: string;
  state: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Holiday {
  id: string;
  calendar_id: string;
  /** Date-only (no time component) — a holiday is a whole day, not an instant. */
  date: string;
  name: string;
}

export const createHolidayCalendarSchema = z.object({
  country: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
});
export type CreateHolidayCalendarInput = z.infer<typeof createHolidayCalendarSchema>;

export const createHolidaySchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1).max(200),
});
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
