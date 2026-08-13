/**
 * Business-day math (docs/10-OPEN-DECISIONS.md §I1) — due dates/overdue status skip weekends
 * and the assignee's regional holidays, confirmed directly with the user ("it should skip
 * weekends and holidays. it should calculate only the business days").
 */

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isBusinessDay(date: Date, holidayDateKeys: ReadonlySet<string>): boolean {
  return !isWeekend(date) && !holidayDateKeys.has(toDateKey(date));
}

/**
 * Counts business days strictly after `from` up to and including `to`. Used to answer "how
 * many working days has this task been late" — a task isn't considered later just because a
 * weekend or holiday passed with no work expected.
 */
export function countBusinessDaysBetween(from: Date, to: Date, holidayDateKeys: ReadonlySet<string>): number {
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    if (isBusinessDay(cursor, holidayDateKeys)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * A task is overdue once at least one full business day has elapsed after its due date —
 * not the instant the calendar due date passes, since no work is expected (and so no lateness
 * accrues) over a weekend or holiday immediately following it.
 */
export function isOverdueOnBusinessDay(dueDate: Date, now: Date, holidayDateKeys: ReadonlySet<string>): boolean {
  return countBusinessDaysBetween(dueDate, now, holidayDateKeys) >= 1;
}
