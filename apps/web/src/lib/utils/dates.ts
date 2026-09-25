/**
 * Shared date formatting utilities (P6-09 - org locale).
 * The organisation is India-based; we use en-IN locale so dates render as
 * '24 Sep 2026' (day-first) rather than the US default '9/24/2026'.
 */
export const ORG_LOCALE = 'en-IN';

/** Short date: "24 Sep 2026" */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleDateString(ORG_LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

/** Short date + time: "24 Sep 2026, 14:30" */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleString(ORG_LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}
