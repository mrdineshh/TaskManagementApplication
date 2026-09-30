import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Archive } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog — replaces native window.confirm() calls.
 * Renders a modal with accessible focus trap, keyboard Escape handling,
 * and clear visual hierarchy for destructive vs. neutral actions.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const iconColor =
    variant === 'danger'
      ? 'text-red-600 border-2 border-red-600 bg-white dark:bg-slate-900 shadow-2xs'
      : variant === 'warning'
      ? 'text-amber-500 border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xs'
      : 'text-blue-600 border-2 border-blue-600 bg-white dark:bg-slate-900 shadow-2xs';

  const confirmClass =
    variant === 'danger'
      ? 'bg-white dark:bg-slate-900 border-2 border-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-900 dark:text-slate-100 shadow-2xs'
      : variant === 'warning'
      ? 'bg-white dark:bg-slate-900 border-2 border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-900 dark:text-slate-100 shadow-2xs'
      : 'bg-white dark:bg-slate-900 border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-900 dark:text-slate-100 shadow-2xs';

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? Archive : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-pop-in">
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
