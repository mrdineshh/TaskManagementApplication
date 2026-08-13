/**
 * Colors are arbitrary Admin-chosen hex values (per-status/priority), so contrast against an
 * unknown light OR dark surface can't be guaranteed by picking a fixed opacity — a thin
 * same-color border (docs/10-OPEN-DECISIONS.md §L) gives every badge a visible edge on both
 * themes even when the low-opacity fill alone would be too faint to read.
 */
export function Badge({ label, color }: { label: string; color?: string | null }) {
  const c = color ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c}1a`, borderColor: `${c}66`, color: c }}
    >
      {label}
    </span>
  );
}
