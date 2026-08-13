import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useTask,
  useTaskActivity,
  useTaskComments,
  useAddComment,
  useTransitionTask,
  useWorkflowStatuses,
  useWorkflowTransitions,
  useOnHoldReasons,
  useCreateTask,
  useTasks,
} from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { TimeLogWidget } from '../../features/tasks/TimeLogWidget';
import { DependenciesWidget } from '../../features/tasks/DependenciesWidget';
import { ApprovalBanner } from '../../features/tasks/ApprovalBanner';
import { EstimateWidget } from '../../features/tasks/EstimateWidget';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading } = useTask(id);
  const { data: activity } = useTaskActivity(id);
  const { data: comments } = useTaskComments(id);
  const { data: statuses } = useWorkflowStatuses(task?.workflow_id);
  const { data: transitions } = useWorkflowTransitions(task?.workflow_id);
  const { data: onHoldReasons } = useOnHoldReasons();
  const { data: subtasks } = useTasks(id ? { parent_task_id: id } : undefined);
  const { data: parentTask } = useTask(task?.parent_task_id ?? undefined);
  const createTask = useCreateTask();
  const transitionTask = useTransitionTask(id!);
  const addComment = useAddComment(id!);
  const [commentBody, setCommentBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Set only while choosing a reason for a status that requires one (docs/10-OPEN-DECISIONS.md §H1) —
  // the transition doesn't fire until a reason is picked.
  const [pendingHoldStatusId, setPendingHoldStatusId] = useState<string | null>(null);
  const [holdReasonId, setHoldReasonId] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (isLoading || !task) return <p className="text-slate-400">Loading…</p>;

  const availableTransitions = (transitions ?? []).filter((t: any) => t.from_status_id === task.status_id);
  const statusLabel = (statusId: string) => statuses?.find((s: any) => s.id === statusId)?.label ?? statusId;
  const statusRequiresHoldReason = (statusId: string) => !!statuses?.find((s: any) => s.id === statusId)?.requires_hold_reason;

  async function runTransition(toStatusId: string, onHoldReasonId?: string) {
    try {
      const result = await transitionTask.mutateAsync({ toStatusId, onHoldReasonId });
      if ('pending_approval' in result && result.pending_approval) {
        setNotice('This move requires approval — a pending approval request was created instead of changing status immediately.');
      } else if ('warnings' in result && result.warnings?.open_blockers?.length) {
        setNotice(`Moved, but this task still has open blockers: ${result.warnings.open_blockers.map((b) => b.task_title).join(', ')}`);
      } else {
        setNotice(null);
      }
      setPendingHoldStatusId(null);
      setHoldReasonId('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  function handleTransition(toStatusId: string) {
    if (statusRequiresHoldReason(toStatusId)) {
      setPendingHoldStatusId(toStatusId);
      return;
    }
    runTransition(toStatusId);
  }

  async function handleCreateSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    await createTask.mutateAsync({ title: newSubtaskTitle, department_id: task!.department_id, parent_task_id: id });
    setNewSubtaskTitle('');
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await addComment.mutateAsync(commentBody);
    setCommentBody('');
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <ApprovalBanner taskId={id!} />

        {notice && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {parentTask && (
            <Link to={`/tasks/${parentTask.id}`} className="mb-2 inline-block text-xs font-medium text-brand-700 hover:underline">
              Subtask of: {parentTask.title}
            </Link>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{task.title}</h1>
          {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(task as any).status && <Badge label={(task as any).status.label} color={(task as any).status.color} />}
            {(task as any).priority && <Badge label={(task as any).priority.label} color={(task as any).priority.color} />}
            {task.is_recurring && <Badge label={`Recurring (${task.recurrence_rule})`} color="#8b5cf6" />}
            {(task as any).on_hold_reason_id &&
              (() => {
                const reason = onHoldReasons?.find((r) => r.id === (task as any).on_hold_reason_id);
                return reason ? <Badge label={`On Hold: ${reason.label}`} color="#a855f7" /> : null;
              })()}
          </div>

          {availableTransitions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <span className="text-xs font-medium uppercase text-slate-400">Move to:</span>
              {availableTransitions.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => handleTransition(t.to_status_id)}
                  disabled={transitionTask.isPending}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {statusLabel(t.to_status_id)}
                  {t.requires_approval && <span className="ml-1 text-amber-500">*</span>}
                </button>
              ))}
            </div>
          )}

          {pendingHoldStatusId && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-purple-200 bg-purple-50 p-3">
              <span className="text-xs font-medium text-purple-800">Reason for {statusLabel(pendingHoldStatusId)}:</span>
              <select
                value={holdReasonId}
                onChange={(e) => setHoldReasonId(e.target.value)}
                className="rounded-md border border-purple-300 px-2 py-1 text-xs"
              >
                <option value="">Select…</option>
                {onHoldReasons?.filter((r) => r.is_active).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                disabled={!holdReasonId || transitionTask.isPending}
                onClick={() => runTransition(pendingHoldStatusId, holdReasonId)}
                className="rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setPendingHoldStatusId(null);
                  setHoldReasonId('');
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <EstimateWidget taskId={id!} task={task as any} />
        <TimeLogWidget taskId={id!} />
        <DependenciesWidget taskId={id!} departmentId={task.department_id} />

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Subtasks</h2>
          <ul className="mb-3 space-y-1">
            {subtasks?.items?.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <Link to={`/tasks/${s.id}`} className="text-slate-700 hover:text-brand-700 hover:underline">
                  {s.title}
                </Link>
                {s.status && <Badge label={s.status.label} color={s.status.color} />}
              </li>
            ))}
            {subtasks?.items?.length === 0 && <li className="text-sm text-slate-400">No subtasks.</li>}
          </ul>
          <form onSubmit={handleCreateSubtask} className="flex gap-2">
            <input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="New subtask title…"
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={createTask.isPending}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Add
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Comments</h2>
          <div className="space-y-3">
            {comments?.map((c: any) => (
              <div key={c.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="text-slate-700">{c.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            ))}
            {comments?.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
          </div>
          <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={addComment.isPending}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Activity</h2>
        <ul className="space-y-2 text-xs text-slate-500">
          {activity?.map((a: any) => (
            <li key={a.id} className="border-b border-slate-100 pb-2 last:border-0">
              <span className="font-medium text-slate-700">{a.action}</span>
              <span className="ml-2">{new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
