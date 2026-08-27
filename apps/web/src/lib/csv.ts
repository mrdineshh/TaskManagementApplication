/**
 * Minimal CSV row parser — good enough for simple two-column admin uploads (holiday lists) where
 * fields don't contain embedded commas/quotes. Not a general CSV parser; if that's ever needed
 * elsewhere, replace this with a real library rather than growing it in place.
 */
export function parseSimpleCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

export interface HolidayCsvRow {
  date: string; // yyyy-mm-dd
  name: string;
}

export interface HolidayCsvParseResult {
  rows: HolidayCsvRow[];
  errors: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Expects two columns per row: date (yyyy-mm-dd) and name. A header row ("date,name" or
 * anything whose first cell isn't a valid date) is detected and skipped automatically. */
export function parseHolidayCsv(text: string): HolidayCsvParseResult {
  const allRows = parseSimpleCsv(text);
  const rows: HolidayCsvRow[] = [];
  const errors: string[] = [];

  allRows.forEach((cells, i) => {
    if (i === 0 && !DATE_RE.test(cells[0])) return; // header row
    if (cells.length < 2 || !cells[0] || !cells[1]) {
      errors.push(`Row ${i + 1}: expected "date,name", got "${cells.join(',')}"`);
      return;
    }
    if (!DATE_RE.test(cells[0])) {
      errors.push(`Row ${i + 1}: "${cells[0]}" isn't a valid date (expected yyyy-mm-dd)`);
      return;
    }
    rows.push({ date: cells[0], name: cells[1] });
  });

  return { rows, errors };
}
