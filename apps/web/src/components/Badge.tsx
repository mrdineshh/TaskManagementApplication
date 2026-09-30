/**
 * Vibrant gradient badge — eliminates washed-out pastel shades with rich,
 * high-contrast modern gradients and crisp contrast.
 */
export function Badge({
  label,
  children,
  color,
  className = '',
}: {
  label?: string;
  children?: React.ReactNode;
  color?: string | null;
  className?: string;
}) {
  const c = (color ?? '#2563eb').toLowerCase();

  let borderColor = '#2563eb';
  if (c.includes('3b82f6') || c.includes('2563eb') || c.includes('blue') || c.includes('0284c7')) {
    borderColor = '#2563eb';
  } else if (c.includes('10b981') || c.includes('059669') || c.includes('emerald') || c.includes('green') || c.includes('14b8a6')) {
    borderColor = '#10b981';
  } else if (c.includes('f59e0b') || c.includes('d97706') || c.includes('amber') || c.includes('yellow') || c.includes('orange') || c.includes('eab308')) {
    borderColor = '#f59e0b';
  } else if (c.includes('ef4444') || c.includes('dc2626') || c.includes('red') || c.includes('rose')) {
    borderColor = '#ef4444';
  } else if (c.includes('8b5cf6') || c.includes('7c3aed') || c.includes('a855f7') || c.includes('purple') || c.includes('violet')) {
    borderColor = '#8b5cf6';
  } else if (c.includes('slate') || c.includes('gray') || c.includes('8e9ab5') || c.includes('64748b')) {
    borderColor = '#64748b';
  } else if (color && color.startsWith('#')) {
    borderColor = color;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0 transition-all select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs ${className}`}
      style={{
        border: `2px solid ${borderColor}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: borderColor }} />
      {children ?? label}
    </span>
  );
}
