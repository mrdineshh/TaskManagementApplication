/**
 * Neumorphic badge — admin-chosen hex color for border/dot/text.
 * Pill shape with soft inset shadow to sit cleanly on the neu-bg surface.
 */
export function Badge({ label, color }: { label: string; color?: string | null }) {
  const c = color ?? "#8e9ab5";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] tracking-wide whitespace-nowrap shrink-0"
      style={{
        backgroundColor: `${c}18`,
        color: c,
        border: `1px solid ${c}33`,
        fontWeight: 600,
        boxShadow: `inset 1px 1px 3px ${c}15, inset -1px -1px 3px rgba(255,255,255,0.5)`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
      {label}
    </span>
  );
}
