import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../lib/toast/toast-store';

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-2 border-emerald-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
  error: 'border-2 border-red-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
  info: 'border-2 border-blue-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (kind === 'error') return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
  return <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />;
}

/** Mounted once at the app root (Shell.tsx) — renders whatever's in useToastStore. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${KIND_STYLES[t.kind]}`}
        >
          <ToastIcon kind={t.kind} />
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="ml-2 p-0.5 opacity-60 hover:opacity-100 rounded transition-opacity" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

