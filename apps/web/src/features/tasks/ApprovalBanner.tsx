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
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
        This task has a status change awaiting approval.
      </p>
      {canApprove ? (
        <div className="mt-2 flex gap-2">
          {pending.map((step) => (
            <div key={step.id} className="flex gap-2">
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'approved' })}
                disabled={decide.isPending}
                className="rounded-md bg-green-600 dark:bg-green-500 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'rejected' })}
                disabled={decide.isPending}
                className="rounded-md bg-red-600 dark:bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
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
