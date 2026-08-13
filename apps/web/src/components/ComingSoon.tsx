export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Planned for {phase} — not yet built.</p>
    </div>
  );
}
