export function Badge({ label, color }: { label: string; color?: string | null }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color ?? '#94a3b8'}20`, color: color ?? '#475569' }}
    >
      {label}
    </span>
  );
}
