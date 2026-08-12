import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useTask,
  useTaskActivity,
  useTaskComments,
  useAddComment,
  useTransitionTask,
  useWorkflowStatuses,
  useWorkflowTransitions,
} from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { TimeLogWidget } from '../../features/tasks/TimeLogWidget';
import { DependenciesWidget } from '../../features/tasks/DependenciesWidget';
import { ApprovalBanner } from '../../features/tasks/ApprovalBanner';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading } = useTask(id);
  const { data: activity } = useTaskActivity(id);
  const { data: comments } = useTaskComments(id);
  const { data: statuses } = useWorkflowStatuses(task?.workflow_id);
  const { data: transitions } = useWorkflowTransitions(task?.workflow_id);
  const transitionTask = useTransitionTask(id!);
  const addComment = useAddComment(id!);
  const [commentBody, setCommentBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading || !task) return <p className="text-slate-400">Loading…</p>;

  const availableTransitions = (transitions ?? []).filter((t: any) => t.from_status_id === task.status_id);
  const statusLabel = (statusId: string) => statuses?.find((s: any) => s.id === statusId)?.label ?? statusId;

  async function handleTransition(toStatusId: string) {
    try {
      const result = await transitionTask.mutateAsync(toStatusId);
      if ('pending_approval' in result && result.pending_approval) {
        setNotice('This move requires approval — a pending approval request was created instead of changing status immediately.');
      } else if ('warnings' in result && result.warnings?.open_blockers?.length) {
        setNotice(`Moved, but this task still has open blockers: ${result.warnings.open_blockers.map((b) => b.task_title).join(', ')}`);
      } else {
        setNotice(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transition failed');
    }
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
          <h1 className="text-lg font-semibold text-slate-900">{task.title}</h1>
          {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(task as any).status && <Badge label={(task as any).status.label} color={(task as any).status.color} />}
            {(task as any).priority && <Badge label={(task as any).priority.label} color={(task as any).priority.color} />}
            {task.is_recurring && <Badge label={`Recurring (${task.recurrence_rule})`} color="#8b5cf6" />}
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
        </div>

        <TimeLogWidget taskId={id!} />
        <DependenciesWidget taskId={id!} departmentId={task.department_id} />

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
