import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface NeuSelectOption {
  value: string;
  label: string;
}

interface NeuSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NeuSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** If true the select renders as a small/compact variant */
  compact?: boolean;
}

/**
 * Custom neumorphic dropdown — replaces native <select> so the options popup
 * also matches the app's visual language. Keyboard-navigable (arrow keys, Enter, Esc).
 * Renders options via createPortal to document.body to avoid stacking context & overflow issues.
 */
export function NeuSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  style,
  compact = false,
}: NeuSelectProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    minWidth: number;
    maxHeight: number;
    openUpwards: boolean;
  }>({
    left: 0,
    width: 0,
    minWidth: 140,
    maxHeight: 224,
    openUpwards: false,
  });

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const width = rect.width;
    const minWidth = Math.max(width, 140);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minWidth - 12);
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = Math.min(224, Math.max(60, options.length * 36 + 12));
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const maxHeight = openUpwards
      ? Math.min(224, Math.max(80, spaceAbove - 16))
      : Math.min(224, Math.max(80, spaceBelow - 16));

    setCoords({
      top: openUpwards ? undefined : Math.round(rect.bottom + 4),
      bottom: openUpwards ? Math.round(window.innerHeight - rect.top + 4) : undefined,
      left: Math.round(left),
      width: Math.round(width),
      minWidth: Math.round(minWidth),
      maxHeight: Math.round(maxHeight),
      openUpwards,
    });
  }, [options.length]);

  function toggleOpen() {
    if (disabled) return;
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  // Close on outside click or reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
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

  // Keep cursor scrolled into view
  useEffect(() => {
    if (open && cursor >= 0 && listRef.current) {
      const activeEl = listRef.current.children[cursor] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursor, open]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && cursor >= 0 && options[cursor]) {
        onChange(options[cursor].value);
        setOpen(false);
      } else {
        toggleOpen();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) toggleOpen();
      setCursor((c) => Math.min(c + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
  }

  const py = compact ? '0.375rem' : '0.625rem';
  const px = compact ? '0.75rem' : '1rem';
  const fs = compact ? '0.75rem' : '0.875rem';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-col ${className}`}
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-disabled={disabled}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex items-center justify-between gap-2 w-full text-left transition-all"
        style={{
          padding: `${py} ${px}`,
          fontSize: fs,
          borderRadius: '0.625rem',
          background: 'var(--neu-bg)',
          color: selectedLabel ? 'var(--text-primary)' : 'var(--text-faint)',
          boxShadow: open
            ? 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light), 0 0 0 3px rgba(37,99,235,0.15)'
            : 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
          outline: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className="shrink-0 transition-transform duration-200"
          style={{
            width: '0.875rem',
            height: '0.875rem',
            color: 'var(--text-faint)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown list rendered via portal directly to document.body */}
      {open &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            className="py-1 overflow-y-auto animate-pop-in"
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              width: `${coords.width}px`,
              minWidth: `${coords.minWidth}px`,
              maxHeight: `${coords.maxHeight}px`,
              borderRadius: '0.875rem',
              background: 'var(--neu-bg)',
              boxShadow:
                '0 12px 28px -4px rgba(0, 0, 0, 0.25), 6px 6px 16px var(--neu-dark), -4px -4px 12px var(--neu-light)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              zIndex: 999999,
            }}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isCursor = i === cursor;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value);
                    setOpen(false);
                    setCursor(-1);
                  }}
                  onMouseEnter={() => setCursor(i)}
                  className="flex items-center gap-2 w-full text-left px-4 transition-colors"
                  style={{
                    padding: compact ? '0.375rem 0.875rem' : '0.5rem 1rem',
                    fontSize: fs,
                    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
                    color: isSelected ? '#2563EB' : 'var(--text-muted)',
                    background: isCursor || isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {isSelected && (
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                  {!isSelected && <span style={{ width: 12, flexShrink: 0 }} />}
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
