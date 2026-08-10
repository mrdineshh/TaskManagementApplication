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
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">
        This task has a status change awaiting approval.
      </p>
      {canApprove ? (
        <div className="mt-2 flex gap-2">
          {pending.map((step) => (
            <div key={step.id} className="flex gap-2">
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'approved' })}
                disabled={decide.isPending}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide.mutate({ stepId: step.id, decision: 'rejected' })}
                disabled={decide.isPending}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-amber-600">Waiting on someone with approval rights.</p>
      )}
    </div>
  );
}
