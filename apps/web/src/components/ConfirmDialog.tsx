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
      ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
      : variant === 'warning'
      ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40'
      : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20'
      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20';

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
