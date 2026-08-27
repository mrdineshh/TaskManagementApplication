import { useToastStore, type ToastKind } from '../lib/toast/toast-store';

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200',
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  info: 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

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
          className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${KIND_STYLES[t.kind]}`}
        >
          <span aria-hidden>{KIND_ICON[t.kind]}</span>
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="ml-2 opacity-60 hover:opacity-100" aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
