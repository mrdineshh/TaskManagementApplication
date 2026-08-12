export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">Planned for {phase} — not yet built.</p>
    </div>
  );
}
