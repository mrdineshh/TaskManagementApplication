import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface NeuDatePickerProps {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string; // 'YYYY-MM-DD'
  max?: string; // 'YYYY-MM-DD'
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return iso;
  const dt = new Date(y, m, d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toIso(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export function NeuDatePicker({
  value,
  onChange,
  placeholder = 'Select date…',
  min,
  max,
  disabled = false,
  compact = false,
  className = '',
  style,
}: NeuDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Month and year being browsed in the calendar
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(() => (isNaN(initialDate.getFullYear()) ? new Date().getFullYear() : initialDate.getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (isNaN(initialDate.getMonth()) ? new Date().getMonth() : initialDate.getMonth()));

  // Sync viewed month when opened or when value changes
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [value, open]);

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    openUpwards: boolean;
  }>({
    left: 0,
    openUpwards: false,
  });

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const calendarWidth = 288; // 18rem
    const calendarHeight = 330;

    let left = rect.left;
    if (left + calendarWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - calendarWidth - 12);
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < calendarHeight && spaceAbove > spaceBelow;

    setCoords({
      top: openUpwards ? undefined : Math.round(rect.bottom + 6),
      bottom: openUpwards ? Math.round(window.innerHeight - rect.top + 6) : undefined,
      left: Math.round(left),
      openUpwards,
    });
  }, []);

  function toggleOpen() {
    if (disabled) return;
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  // Handle outside click and scroll/resize repositioning
  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScrollOrResize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      updatePosition();
    }

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, updatePosition]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDate(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function selectToday() {
    const today = new Date();
    const iso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
    onChange(iso);
    setOpen(false);
  }

  function clearDate(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    onChange('');
    setOpen(false);
  }

  // Generate days grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const days: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isDisabled: boolean;
    isSelected: boolean;
    isToday: boolean;
  }> = [];

  const today = new Date();
  const todayStr = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  // Leading days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = toIso(y, m, d);
    const isDis = Boolean((min && dateStr < min) || (max && dateStr > max));
    days.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isDisabled: isDis,
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toIso(viewYear, viewMonth, d);
    const isDis = Boolean((min && dateStr < min) || (max && dateStr > max));
    days.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isDisabled: isDis,
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  // Trailing days from next month to fill complete grid
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = toIso(y, m, d);
    const isDis = Boolean((min && dateStr < min) || (max && dateStr > max));
    days.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isDisabled: isDis,
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  const py = compact ? '0.375rem' : '0.5rem';
  const px = compact ? '0.75rem' : '0.875rem';
  const fs = compact ? '0.75rem' : '0.875rem';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-col ${className}`}
      style={style}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex items-center justify-between gap-2 text-left transition-all w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
        style={{
          padding: `${py} ${px}`,
          fontSize: fs,
          borderRadius: '0.625rem',
          color: value ? 'var(--text-primary)' : 'var(--text-faint)',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.15)' : undefined,
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearDate}
              onKeyDown={(e) => e.key === 'Enter' && clearDate()}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear date"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <CalendarIcon
            className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 transition-transform duration-200"
            style={{ transform: open ? 'scale(1.1)' : 'scale(1)' }}
          />
        </div>
      </button>

      {/* Calendar Portal Popover */}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="p-3 animate-pop-in select-none border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              width: '18rem',
              borderRadius: '1rem',
              zIndex: 999999,
              fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {/* Header: Month / Year with Prev & Next buttons */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-center">
              {WEEKDAY_NAMES.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-0.5"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, idx) => {
                if (d.isDisabled) {
                  return (
                    <span
                      key={idx}
                      className="flex items-center justify-center h-7 text-xs text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-30"
                    >
                      {d.dayNum}
                    </span>
                  );
                }

                if (d.isSelected) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectDate(d.dateStr)}
                      className="flex items-center justify-center h-7 text-xs font-bold rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-500/40 transition-all scale-105"
                    >
                      {d.dayNum}
                    </button>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectDate(d.dateStr)}
                    className={`flex items-center justify-center h-7 text-xs rounded-lg transition-colors ${
                      d.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 font-medium'
                        : 'text-slate-400 dark:text-slate-600 hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                    } ${d.isToday ? 'border border-brand-500/40 font-bold' : ''}`}
                  >
                    {d.dayNum}
                  </button>
                );
              })}
            </div>

            {/* Footer action bar */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between px-1 text-xs">
              <button
                type="button"
                onClick={() => clearDate()}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={selectToday}
                className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                Today
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
