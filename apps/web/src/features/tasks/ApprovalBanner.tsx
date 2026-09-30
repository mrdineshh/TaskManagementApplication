import { useApprovalSteps, useDecideApprovalStep } from './hooks';
import { usePermission } from '../../lib/permissions/usePermission';

/** Pending-approval banner + decide actions (docs/05-FEATURES.md §2.5). */
export function ApprovalBanner({ taskId }: { taskId: string }) {
  const { data: steps } = useApprovalSteps(taskId);
  const decide = useDecideApprovalStep(taskId);
  const canApprove = usePermission('approval.approve');

  const pending = steps?.filter((s) => s.status === 'pending') ?? [];
  if (pending.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-neu-sm p-4">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        This task has a status change awaiting approval.
      </p>
      {canApprove ? (
        <div className="mt-2 flex gap-2">
          {pending.map((step) => (
            <div key={step.id} className="flex gap-2">
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'approved' })}
                disabled={decide.isPending}
                className="rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow-neu-sm disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'rejected' })}
                disabled={decide.isPending}
                className="rounded-md border-2 border-red-600 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-neu-sm disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Waiting on someone with approval rights.</p>
      )}
    </div>
  );
}
