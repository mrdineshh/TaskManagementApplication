import { useState } from 'react';

export const DATE_RANGE_PRESETS = [
  'today',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year_calendar',
  'this_year_fiscal',
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  this_quarter: 'This quarter',
  last_quarter: 'Last quarter',
  this_year_calendar: 'This year (calendar)',
  this_year_fiscal: 'This year (fiscal)',
};

// India-standard fiscal year (April-March) — this org's seed data (Diwali/Pongal/Republic Day
// holidays) is India-based, and there's no org-level fiscal-year-start setting yet to read
// instead. Revisit if/when Org Settings grows one.
const FISCAL_YEAR_START_MONTH = 3; // 0-indexed: April

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0 = Sunday
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Resolves a preset key to concrete [start, end] dates, anchored on `now`. Exported so callers
 * that only need the resolved range (not the preset identity) can use it directly. */
export function resolvePreset(preset: DateRangePreset, now = new Date()): { start: Date; end: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'this_week': {
      const start = startOfWeek(today);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    case 'last_week': {
      const start = startOfWeek(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const start = new Date(today.getFullYear(), qStartMonth, 1);
      const end = new Date(today.getFullYear(), qStartMonth + 3, 0);
      return { start, end };
    }
    case 'last_quarter': {
      const qStartMonth = Math.floor(today.getMonth() / 3) * 3 - 3;
      const start = new Date(today.getFullYear(), qStartMonth, 1);
      const end = new Date(today.getFullYear(), qStartMonth + 3, 0);
      return { start, end };
    }
    case 'this_year_calendar': {
      return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
    }
    case 'this_year_fiscal': {
      const fyStartYear = today.getMonth() >= FISCAL_YEAR_START_MONTH ? today.getFullYear() : today.getFullYear() - 1;
      return {
        start: new Date(fyStartYear, FISCAL_YEAR_START_MONTH, 1),
        end: new Date(fyStartYear + 1, FISCAL_YEAR_START_MONTH, 0),
      };
    }
    default:
      // A saved report from before this preset set changed (e.g. the removed last_7_days/
      // last_30_days) — fall back rather than returning undefined, matching the same defensive
      // default in apps/api/src/reports/reports.service.ts's resolveDateRange().
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }
}

export interface DateRangeResult {
  preset: DateRangePreset | null;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
}

interface Props {
  value: DateRangeResult;
  onChange: (result: DateRangeResult) => void;
  className?: string;
}

/**
 * Shared date-range filter (docs/10-OPEN-DECISIONS.md §M9) — replaces every ad-hoc pair of raw
 * `<input type="date">` fields with one preset dropdown + a "Custom range" fallback. Always
 * returns a resolved concrete [start, end] alongside the chosen preset key (or null for
 * custom), so callers needing a live-recomputing preset (e.g. a saved/scheduled report's "this
 * month" should mean the month it runs in, not the month it was configured) can persist just
 * the preset, while callers that only ever want concrete dates (e.g. Scorecard's live query)
 * can ignore it and use start/end directly.
 */
export function DateRangePicker({ value, onChange, className = '' }: Props) {
  const [showCustom, setShowCustom] = useState(value.preset === null);

  function handlePresetChange(v: string) {
    if (v === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const preset = v as DateRangePreset;
    const { start, end } = resolvePreset(preset);
    onChange({ preset, start: toIsoDate(start), end: toIsoDate(end) });
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <select
        value={showCustom ? 'custom' : (value.preset ?? 'this_month')}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
      >
        {DATE_RANGE_PRESETS.map((p) => (
          <option key={p} value={p}>
            {PRESET_LABELS[p]}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>
      {showCustom && (
        <>
          <input
            type="date"
            value={value.start}
            max={value.end}
            onChange={(e) => onChange({ preset: null, start: e.target.value, end: value.end })}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
          <input
            type="date"
            value={value.end}
            min={value.start}
            onChange={(e) => onChange({ preset: null, start: value.start, end: e.target.value })}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
          />
        </>
      )}
    </div>
  );
}
