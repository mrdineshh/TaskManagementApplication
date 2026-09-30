import { useEffect, useRef, useState } from 'react';
import { toast } from '../../lib/toast/toast-store';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useTask,
  useTaskActivity,
  useTaskComments,
  useAddComment,
  useDeleteComment,
  useTransitionTask,
  useWorkflowStatuses,
  useWorkflowTransitions,
  useOnHoldReasons,
  useCreateTask,
  useTasks,
  useAssignTask,
  useUsers,
  useReviewAction,
  useClockOut,
  useClockIn,
  useArchiveTask,
  usePermanentDeleteTask,
  useCreateTaskActionRequest,
  useTaskActionRequest,
  useDecideTaskActionRequest,
  useUpdateComment,
  useSubmitEstimate,
  useUpdateTask,
} from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { NeuSelect } from '../../components/NeuSelect';
import { NeuDatePicker } from '../../components/NeuDatePicker';
import { ShieldAlert, Clock, CheckCircle, CheckCircle2, RotateCcw, LogOut, Play, Archive, Trash2, Pencil, AlertTriangle, X, Paperclip, FileText, ChevronLeft, Activity, ChevronRight, Calendar, CheckSquare, MessageSquare, Send, Plus, Repeat, Pause, History } from 'lucide-react';
import { DependenciesWidget } from '../../features/tasks/DependenciesWidget';
import { ApprovalBanner } from '../../features/tasks/ApprovalBanner';
import { RichTextEditor } from '../../components/RichTextEditor';
import { RecurrenceWidget } from '../../features/tasks/RecurrenceWidget';
import { WorkSessionTimer } from '../../features/tasks/WorkSessionTimer';
import { ReviewFeedbackCard } from '../../features/tasks/ReviewFeedbackCard';
import { CustomFieldsWidget } from '../../features/tasks/CustomFieldsWidget';
import { EstimateWidget } from '../../features/tasks/EstimateWidget';
import { TimeLogWidget } from '../../features/tasks/TimeLogWidget';
import { usePermission } from '../../lib/permissions/usePermission';
import { useSessionStore } from '../../lib/auth/session-store';
import { fmtDate } from '../../lib/utils/dates';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Permission checks — cosmetic gates only; the API enforces the same rules server-side.
  // These must be computed BEFORE useUsers so we can pass fetchAll correctly.
  const canAssign = usePermission('task.assign');
  const canDeleteTask = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const currentUser = useSessionStore((s) => s.currentUser);
  const hasManagerRole = Boolean(
    currentUser?.roles?.some((r: any) =>
      ['Admin', 'Manager', 'Head', 'Management'].includes(typeof r === 'string' ? r : r?.name)
    )
  );
  const isManagerOrAdmin = canDeleteTask || canManageUsers || hasManagerRole;
  const [activityOpen, setActivityOpen] = useState(false);

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
  const assignTask = useAssignTask(id!);
  const reviewAction = useReviewAction(id!);
  const clockOut = useClockOut(id!);
  const clockIn = useClockIn(id!);
  const archiveTask = useArchiveTask();
  const permanentDelete = usePermanentDeleteTask();
  const createActionRequest = useCreateTaskActionRequest();
  const { data: pendingActionRequest } = useTaskActionRequest(id);
  const decideActionRequest = useDecideTaskActionRequest();
  // fetchAll=true for managers/admins so they can see ALL team members across departments.
  const { data: members } = useUsers(task?.department_id, isManagerOrAdmin);
  const addComment = useAddComment(id!);
  const deleteComment = useDeleteComment(id!);
  const updateComment = useUpdateComment(id!);
  const submitEstimate = useSubmitEstimate(id!);
  const updateTask = useUpdateTask(id!);
  const [timelineEditing, setTimelineEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [timelineSaving, setTimelineSaving] = useState(false);

  useEffect(() => {
    if (task) {
      if (task.start_date) setEditStartDate(task.start_date.slice(0, 10));
      if (task.due_date) setEditDueDate(task.due_date.slice(0, 10));
    }
  }, [task]);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');

  const isAssignee = task?.assignee_id === currentUser?.id || (task as any)?.assignee?.id === currentUser?.id;
  const isCreator = Boolean(
    (task as any)?.created_by_id === currentUser?.id ||
    (task as any)?.createdById === currentUser?.id ||
    (task as any)?.created_by?.id === currentUser?.id ||
    (task as any)?.createdBy?.id === currentUser?.id
  );
  const isUnassignedSelfCreator = !task?.assignee_id && isCreator;
  const canAccessTask = isManagerOrAdmin || isAssignee || isUnassignedSelfCreator;
  const canEditTaskSettings = isManagerOrAdmin || isAssignee || isUnassignedSelfCreator;
  const canManageSubtasks = isManagerOrAdmin || isAssignee || isUnassignedSelfCreator;
  const canReassignTask = isManagerOrAdmin || isCreator;

  const [commentBody, setCommentBody] = useState('');
  const [commentKey, setCommentKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingHoldStatusId, setPendingHoldStatusId] = useState<string | null>(null);
  const [holdReasonId, setHoldReasonId] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFiles, setReviewFiles] = useState<Array<{ file_name: string; mime_type: string; size_bytes: number; content_base64: string }>>([]);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestActionType, setRequestActionType] = useState<'archive' | 'delete'>('archive');
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  function handleReviewFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        if (base64Data) {
          setReviewFiles((prev) => [
            ...prev,
            {
              file_name: file.name,
              mime_type: file.type || 'application/octet-stream',
              size_bytes: file.size,
              content_base64: base64Data,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  async function handleDirectArchive() {
    if (window.confirm('Archive this task? It will be moved to Archived Tasks in Settings.')) {
      await archiveTask.mutateAsync(id!);
      navigate('/tasks');
    }
  }

  async function handleDirectDelete() {
    if (window.confirm('Are you sure you want to permanently delete this task from the database? This action cannot be undone.')) {
      await permanentDelete.mutateAsync(id!);
      navigate('/tasks');
    }
  }

  async function handleDecideRequest(decision: 'approved' | 'rejected') {
    if (!pendingActionRequest) return;
    const isDelete = pendingActionRequest.action_type === 'delete';
    if (decision === 'approved' && isDelete && !window.confirm('Approve permanent deletion? This task will be permanently deleted from the database.')) {
      return;
    }
    await decideActionRequest.mutateAsync({
      requestId: pendingActionRequest.id,
      decision,
    });
    if (decision === 'approved') {
      navigate('/tasks');
    }
  }

  async function handleSubmitActionRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setRequestSubmitting(true);
    try {
      await createActionRequest.mutateAsync({
        taskId: id,
        actionType: requestActionType,
        reason: requestReason.trim() || undefined,
      });
      setRequestModalOpen(false);
      setRequestReason('');
    } finally {
      setRequestSubmitting(false);
    }
  }

  if (isLoading || !task) return <p className="text-slate-400 dark:text-slate-500">Loading…</p>;

  if (!canAccessTask) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Task Access Restricted</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This task is assigned to <strong>{(task as any)?.assignee?.full_name ?? 'another team member'}</strong>. Regular employees can only open, edit, and view settings for tasks assigned to themselves.
        </p>
        <Link
          to="/tasks"
          className="mt-5 inline-flex items-center gap-1.5 btn-primary transition-colors"
        >
          ← Back to All Tasks
        </Link>
      </div>
    );
  }

  // Derive timer values
  const timerStartedAt = (task as any).timerStartedAt ?? (task as any).timer_started_at ?? null;
  const totalLoggedMinutes = (task as any).totalLoggedMinutes ?? (task as any).total_logged_minutes ?? 0;
  const isRunning = Boolean(timerStartedAt);

  const currentStatus = statuses?.find((s: any) => s.id === (task.status_id ?? (task as any).statusId));
  const isReviewStatus = Boolean(
    currentStatus?.is_review_status ||
    (task as any).status?.isReviewStatus ||
    (task as any).status?.is_review_status ||
    currentStatus?.key === 'in_review' ||
    (task as any).status?.key === 'in_review' ||
    currentStatus?.label?.toLowerCase().includes('review') ||
    (task as any).status?.label?.toLowerCase().includes('review')
  );
  const isInProgressStatus = Boolean(
    currentStatus?.category === 'in_progress' && !isReviewStatus
  );

  const estimateVal = (task as any)?.estimate_value ?? (task as any)?.estimateValue ?? null;
  const isMissingSchedule = !task?.start_date || !task?.due_date || estimateVal === null;
  const todayStr = new Date().toISOString().slice(0, 10);

  async function handleSaveTimeline() {
    if (!editStartDate || !editDueDate) {
      toast.error('Both Start Date and Due Date are required.');
      return;
    }
    if (editDueDate < editStartDate) {
      toast.error('Due Date cannot be earlier than Start Date.');
      return;
    }
    setTimelineSaving(true);
    try {
      await updateTask.mutateAsync({ start_date: editStartDate, due_date: editDueDate });
      setTimelineEditing(false);
      toast.success('Task schedule updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update timeline');
    } finally {
      setTimelineSaving(false);
    }
  }

  const rawTransitions = (transitions ?? []).filter((t: any) => t.from_status_id === task.status_id);
  const doneStatus = statuses?.find((s: any) => s.category === 'done' || s.key === 'done');
  const isDoneCategory = currentStatus?.category === 'done' || currentStatus?.key === 'done';

  const hasDoneTransition = rawTransitions.some((t: any) => {
    const toS = statuses?.find((s: any) => s.id === t.to_status_id);
    return toS?.category === 'done' || toS?.key === 'done';
  });

  const availableTransitions = [...rawTransitions];
  if (!isDoneCategory && doneStatus && !hasDoneTransition) {
    availableTransitions.unshift({
      id: `virtual-done-${doneStatus.id}`,
      workflow_id: task.workflow_id,
      from_status_id: task.status_id,
      to_status_id: doneStatus.id,
      required_permission: null,
      requires_approval: false,
    });
  }

  const statusLabel = (statusId: string) => statuses?.find((s: any) => s.id === statusId)?.label ?? statusId;
  const statusRequiresHoldReason = (statusId: string) => !!statuses?.find((s: any) => s.id === statusId)?.requires_hold_reason;

  const inProgressStatus = statuses?.find(
    (s: any) => s.category === 'in_progress' || s.key === 'in_progress' || s.label?.toLowerCase() === 'in progress'
  );
  const reviewStatus = statuses?.find(
    (s: any) => s.is_review_status || s.key === 'in_review' || s.label?.toLowerCase().includes('review')
  );

  async function handleMarkReviewAsRead() {
    if (inProgressStatus && task?.status_id !== inProgressStatus.id) {
      await runTransition(inProgressStatus.id);
      toast.success('Feedback acknowledged — task moved to In Progress');
    }
  }

  function handleRequestReview() {
    if (reviewStatus) {
      handleTransition(reviewStatus.id);
    } else {
      toast.info('No In Review status available in this workflow');
    }
  }

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
      toast.error(err instanceof Error ? err.message : 'Transition failed');
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
    const stripped = commentBody.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return;
    await addComment.mutateAsync(commentBody);
    setCommentBody('');
    setCommentKey((k) => k + 1); // force RTE remount to clear editor content
  }

  return (
    <div className="space-y-4">
      {/* Top action bar — Activity log toggle */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setActivityOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          title={activityOpen ? 'Hide activity log' : 'Show activity log'}
        >
          <Activity className="w-3.5 h-3.5" />
          {activityOpen ? 'Hide Activity' : 'Activity Log'}
          {activityOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 rotate-180" />}
        </button>
      </div>

      <div className={`grid gap-6 ${activityOpen ? 'grid-cols-3' : 'grid-cols-1'}`}>
      <div className={`${activityOpen ? 'col-span-2' : 'col-span-1'} space-y-4`}>
        <ApprovalBanner taskId={id!} />

        {notice && (
          <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            {notice}
          </div>
        )}



        {/* Manager Review Action Panel */}
        {isReviewStatus && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                    Task Submitted for Review
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                    Timer Paused
                  </span>
                </div>
                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                  {isManagerOrAdmin
                    ? 'The employee has completed this work session and submitted the task for review. Review the work and approve to mark it Done, or request changes to return it to To Do.'
                    : 'This task is currently awaiting manager review. The work timer has stopped and your manager has been notified.'}
                </p>

                {isManagerOrAdmin && (
                  <div className="mt-4 space-y-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/60">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Manager Feedback / Comments (mandatory when requesting changes):
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Add review feedback, required changes, or approval remarks…"
                        rows={3}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    {/* Reference File Attachments for Review */}
                    <div>
                      <input
                        type="file"
                        multiple
                        ref={reviewFileInputRef}
                        onChange={handleReviewFilesSelected}
                        className="hidden"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => reviewFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shadow-xs"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach Reference Files (Screenshots, Mockups, Specs)
                        </button>
                        {reviewFiles.length > 0 && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {reviewFiles.length} file{reviewFiles.length > 1 ? 's' : ''} attached
                          </span>
                        )}
                      </div>

                      {reviewFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {reviewFiles.map((file, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-1 text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                            >
                              <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span className="max-w-[140px] truncate" title={file.file_name}>
                                {file.file_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setReviewFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="ml-1 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={reviewAction.isPending}
                        onClick={async () => {
                          await reviewAction.mutateAsync({
                            action: 'approve',
                            comment: reviewComment || undefined,
                            attachments: reviewFiles.length > 0 ? reviewFiles : undefined,
                          });
                          setReviewComment('');
                          setReviewFiles([]);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50 shadow-neu-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Approve &amp; Mark Done
                      </button>
                      <button
                        type="button"
                        disabled={reviewAction.isPending || !reviewComment.trim()}
                        title={!reviewComment.trim() ? 'Please provide feedback comments explaining what changes are needed' : undefined}
                        onClick={async () => {
                          if (!reviewComment.trim()) {
                            toast.error('Please provide feedback comments explaining what changes are needed.');
                            return;
                          }
                          await reviewAction.mutateAsync({
                            action: 'request_changes',
                            comment: reviewComment.trim(),
                            attachments: reviewFiles.length > 0 ? reviewFiles : undefined,
                          });
                          setReviewComment('');
                          setReviewFiles([]);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border-2 border-amber-500 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50 shadow-neu-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        Request Changes (Return to To Do)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Work Session Timer Card */}
        {(timerStartedAt || totalLoggedMinutes > 0 || isInProgressStatus) && (() => {
          const estimateVal = (task as any).estimate_value ?? (task as any).estimateValue ?? null;
          const estimateUnitStr = (task as any).estimate_unit ?? (task as any).estimateUnit ?? 'hours';
          const estimateMins = estimateVal
            ? estimateUnitStr === 'days'
              ? estimateVal * 8 * 60
              : estimateVal * 60
            : null;
          return (
            <WorkSessionTimer
              timerStartedAt={timerStartedAt}
              totalLoggedMinutes={totalLoggedMinutes}
              size="full"
              estimateMinutes={estimateMins}
              onExtendEstimate={canEditTaskSettings
                ? async (hours) => {
                    await submitEstimate.mutateAsync({ value: hours, unit: 'hours' });
                  }
                : undefined
              }
              onRequestReview={reviewStatus ? handleRequestReview : undefined}
            />
          );
        })()}

        {/* Pending Action Request Banner */}
        {pendingActionRequest && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/50 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                      {pendingActionRequest.action_type === 'archive' ? 'Archive Request Pending' : 'Permanent Deletion Request Pending'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({fmtDate(pendingActionRequest.created_at)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    <strong>{pendingActionRequest.requester?.full_name ?? 'Team member'}</strong> requested to{' '}
                    <span className="font-semibold">{pendingActionRequest.action_type}</span> this task.
                    {pendingActionRequest.reason && (
                      <span className="italic ml-1">"&ldquo;{pendingActionRequest.reason}&rdquo;"</span>
                    )}
                  </p>
                </div>
              </div>

              {isManagerOrAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={decideActionRequest.isPending}
                    onClick={() => handleDecideRequest('approved')}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold shadow-neu-sm transition-all disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Approve &amp; {pendingActionRequest.action_type === 'archive' ? 'Archive' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    disabled={decideActionRequest.isPending}
                    onClick={() => handleDecideRequest('rejected')}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Required: Mandatory Scheduling & Effort Estimation Warning */}
        {isMissingSchedule && (
          <div className="rounded-2xl border-2 border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 p-4 sm:p-5 shadow-neu-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-amber-500 text-white shrink-0 shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    Action Required: Complete Scheduling &amp; Effort Estimation
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    {isManagerOrAdmin
                      ? 'This task was assigned without full schedule parameters. Assignees cannot start work or run work timers until Start Date, Due Date, and Effort Estimation are specified.'
                      : 'You cannot move this task to In Progress or clock in until Start Date, Due Date, and Effort Estimation are provided below.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {!task.start_date && (
                      <span className="rounded bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-2 py-0.5 text-red-700 dark:text-red-300">
                        Missing Start Date
                      </span>
                    )}
                    {!task.due_date && (
                      <span className="rounded bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-2 py-0.5 text-red-700 dark:text-red-300">
                        Missing Due Date
                      </span>
                    )}
                    {estimateVal === null && (
                      <span className="rounded bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-2 py-0.5 text-red-700 dark:text-red-300">
                        Missing Effort Estimation
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {canEditTaskSettings && !timelineEditing && (!task.start_date || !task.due_date) && (
                <button
                  type="button"
                  onClick={() => setTimelineEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-amber-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-neu-sm transition-all shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Set Dates Now
                </button>
              )}
            </div>
          </div>
        )}

        <div className="neu-card rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              {parentTask && (
                <Link to={`/tasks/${parentTask.id}`} className="mb-2 inline-block text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline">
                  Subtask of: {parentTask.title}
                </Link>
              )}
              <h1 className="text-2xl">{task.title}</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isManagerOrAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={handleDirectArchive}
                    disabled={archiveTask.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-600 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectDelete}
                    disabled={permanentDelete.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 shadow-neu-sm transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestActionType('archive');
                      setRequestModalOpen(true);
                    }}
                    disabled={Boolean(pendingActionRequest)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-600 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all disabled:opacity-50"
                    title={pendingActionRequest ? 'A request is already pending for this task' : 'Request manager to archive this task'}
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    Request Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestActionType('delete');
                      setRequestModalOpen(true);
                    }}
                    disabled={Boolean(pendingActionRequest)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 shadow-neu-sm transition-all disabled:opacity-50"
                    title={pendingActionRequest ? 'A request is already pending for this task' : 'Request manager to delete this task'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Request Delete
                  </button>
                </>
              )}
            </div>
          </div>
          {task.description && (
            <div
              className="mt-2 prose dark:prose-invert prose-sm max-w-none text-sm text-slate-600 dark:text-slate-400"
              dangerouslySetInnerHTML={{ __html: task.description }}
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(task as any).status && <Badge label={(task as any).status.label} color={(task as any).status.color} />}
            {(task as any).priority && <Badge label={(task as any).priority.label} color={(task as any).priority.color} />}
            {task.is_recurring && (
              <Badge color="#8b5cf6">
                <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0 mr-0.5" />
                <span>
                  {task.recurrence_rule === 'FREQ=DAILY' ? 'Every day' :
                  task.recurrence_rule === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' ? 'Every weekday (Mon–Fri)' :
                  task.recurrence_rule === 'FREQ=WEEKLY' ? 'Every week' :
                  task.recurrence_rule === 'FREQ=WEEKLY;INTERVAL=2' ? 'Every 2 weeks' :
                  task.recurrence_rule === 'FREQ=MONTHLY' ? 'Every month' :
                  task.recurrence_rule === 'FREQ=MONTHLY;INTERVAL=3' ? 'Every quarter' :
                  task.recurrence_rule ? `Custom: ${task.recurrence_rule}` : 'Recurring'}
                </span>
              </Badge>
            )}
            {(task as any).on_hold_reason_id &&
              (() => {
                const reason = onHoldReasons?.find((r) => r.id === (task as any).on_hold_reason_id);
                return reason ? <Badge label={`On Hold: ${reason.label}`} color="#a855f7" /> : null;
              })()}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
            {/* Assigned By row — shows the task creator */}
            {(task as any).created_by && (
              <div className="flex items-center gap-2 col-span-full sm:col-span-1">
                <span className="font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assigned By:</span>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {(task as any).created_by?.full_name ?? (task as any).createdBy?.full_name ?? 'Unknown'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assigned to:</span>
              {canReassignTask ? (
                <NeuSelect
                  value={task.assignee_id ?? ''}
                  onChange={(v) => assignTask.mutate(v || null)}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...((members as { id: string; full_name: string }[] | undefined) ?? []).map((m) => ({
                      value: m.id,
                      label: m.full_name,
                    })),
                  ]}
                  placeholder="Unassigned"
                  compact
                  disabled={assignTask.isPending}
                  style={{ minWidth: '140px' }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {task.assignee_id
                      ? (members as { id: string; full_name: string }[] | undefined)?.find((m) => m.id === task.assignee_id)?.full_name ??
                        (task as any).assignee?.full_name ??
                        (task as any).assignee?.fullName ??
                        'Assigned'
                      : 'Unassigned'}
                  </span>
                  {!task.assignee_id && currentUser && (
                    <button
                      onClick={() => assignTask.mutate(currentUser.id)}
                      disabled={assignTask.isPending}
                      className="rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-300 dark:border-brand-700 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/80 transition-colors disabled:opacity-50"
                    >
                      Assign to me
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Timeline:</span>
              {task.start_date && task.due_date ? (
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {fmtDate(task.start_date)} → {fmtDate(task.due_date)}
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Schedule Not Set
                </span>
              )}
              {canEditTaskSettings && !timelineEditing && (
                <button
                  type="button"
                  onClick={() => setTimelineEditing(true)}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all ml-1"
                >
                  <Pencil className="w-3 h-3 text-blue-600" />
                  {task.start_date && task.due_date ? 'Edit Dates' : 'Set Dates'}
                </button>
              )}
            </div>

            {timelineEditing && (
              <div className="col-span-full rounded-xl border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 p-3 shadow-neu-sm animate-fade-in mt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Start Date (Today or future)
                    </label>
                    <NeuDatePicker
                      value={editStartDate}
                      onChange={(v) => {
                        setEditStartDate(v);
                        if (editDueDate && editDueDate < v) setEditDueDate(v);
                      }}
                      min={todayStr}
                      placeholder="Start date"
                      compact
                      style={{ minWidth: '140px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Due Date (&ge; Start Date)
                    </label>
                    <NeuDatePicker
                      value={editDueDate}
                      onChange={setEditDueDate}
                      min={editStartDate || todayStr}
                      placeholder="Due date"
                      compact
                      style={{ minWidth: '140px' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 self-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveTimeline}
                      disabled={timelineSaving || !editStartDate || !editDueDate}
                      className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-neu-sm transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {timelineSaving ? 'Saving…' : 'Save Dates'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimelineEditing(false);
                        setEditStartDate(task?.start_date ? task.start_date.slice(0, 10) : '');
                        setEditDueDate(task?.due_date ? task.due_date.slice(0, 10) : '');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-neu-sm transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {availableTransitions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                Move to:
              </span>
              {availableTransitions.map((t: any) => {
                const toStatus = statuses?.find((s: any) => s.id === t.to_status_id);
                const isDone = toStatus?.category === 'done' || toStatus?.key === 'done';
                const isReview = toStatus?.key === 'in_review' || toStatus?.is_review_status || toStatus?.label?.toLowerCase().includes('review');
                const isCancelled = toStatus?.category === 'cancelled' || toStatus?.key === 'cancelled';
                const isToInProgress = toStatus?.category === 'in_progress' || toStatus?.key === 'in_progress' || toStatus?.label?.toLowerCase() === 'in progress';
                const isBlockedBySchedule = isToInProgress && isMissingSchedule;

                let buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50';

                if (isBlockedBySchedule) {
                  buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 px-3.5 py-1.5 text-xs font-semibold shadow-none cursor-not-allowed opacity-60';
                } else if (isDone) {
                  buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-900 dark:text-slate-100 px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50';
                } else if (isReview) {
                  buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-900 dark:text-slate-100 px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50';
                } else if (isCancelled) {
                  buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50';
                }

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (isBlockedBySchedule) {
                        toast.error('Cannot move to In Progress: Start Date, Due Date, and Effort Estimation must be filled first.');
                        return;
                      }
                      handleTransition(t.to_status_id);
                    }}
                    disabled={transitionTask.isPending || (!canEditTaskSettings && !isAssignee) || isBlockedBySchedule}
                    className={buttonClass}
                    title={
                      isBlockedBySchedule
                        ? 'Mandatory: Set Start Date, Due Date, and Effort Estimation before moving to In Progress'
                        : isDone
                        ? 'Mark this task as completed'
                        : undefined
                    }
                  >
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {isReview && <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    {isCancelled && <X className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                    {statusLabel(t.to_status_id)}
                    {t.requires_approval && <span className="ml-1 text-amber-500 font-bold">*</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Clock In / Clock Out session controls — ONLY for the assignee (not managers) on In Progress tasks */}
          {isInProgressStatus && isAssignee && (
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border-2 shadow-2xs ${
                      isRunning
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-amber-500 text-amber-500'
                    }`}
                  >
                    {isRunning ? (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-600 animate-ping" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Work Session:
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border-2 text-slate-900 dark:text-slate-100 shadow-2xs ${
                          isRunning
                            ? 'border-emerald-600'
                            : 'border-amber-500'
                        }`}
                      >
                        {isRunning ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Timer Active
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>Clocked Out</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {isRunning
                        ? 'Your active session is running and logging live time.'
                        : 'You are currently clocked out of this task. Click Clock In to restart recording time.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <button
                      type="button"
                      id="clock-out-btn"
                      onClick={() => clockOut.mutate()}
                      disabled={clockOut.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border-2 border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-900 dark:text-slate-100 px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5 text-amber-600" />
                      {clockOut.isPending ? 'Clocking out…' : 'Clock Out (Pause Timer)'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="clock-in-btn"
                      onClick={() => {
                        if (isMissingSchedule) {
                          toast.error('Start Date, Due Date, and Effort Estimation are required before clocking in.');
                          return;
                        }
                        clockIn.mutate();
                      }}
                      disabled={clockIn.isPending || isMissingSchedule}
                      className={`inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border-2 px-4 py-2 text-xs font-semibold shadow-2xs transition-all ${
                        isMissingSchedule
                          ? 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                          : 'border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-900 dark:text-slate-100 disabled:opacity-50'
                      }`}
                      title={isMissingSchedule ? 'Start Date, Due Date, and Effort Estimation are required before clocking in' : undefined}
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-blue-600" />
                      {clockIn.isPending ? 'Clocking in…' : 'Clock In (Resume Work)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {pendingHoldStatusId && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 shadow-xs" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Reason for {statusLabel(pendingHoldStatusId)}:</span>
              <NeuSelect
                value={holdReasonId}
                onChange={setHoldReasonId}
                options={[
                  { value: '', label: 'Select reason…' },
                  ...(onHoldReasons ?? []).filter((r) => r.is_active).map((r) => ({
                    value: r.id,
                    label: r.label,
                  })),
                ]}
                placeholder="Select reason…"
                compact
                style={{ minWidth: '150px' }}
              />
              <button
                disabled={!holdReasonId || transitionTask.isPending}
                onClick={() => runTransition(pendingHoldStatusId, holdReasonId)}
                className="btn-primary !py-1 !px-3 !text-xs disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setPendingHoldStatusId(null);
                  setHoldReasonId('');
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Review Feedback Card — 2nd position: below Project Details, above Recurrence */}
        <ReviewFeedbackCard
          taskId={id!}
          isAssignee={isAssignee}
          isManagerOrAdmin={isManagerOrAdmin}
          isInReviewStatus={isReviewStatus}
          onRequestReview={reviewStatus ? handleRequestReview : undefined}
          onMarkAsRead={handleMarkReviewAsRead}
        />

        <RecurrenceWidget
          taskId={id!}
          isRecurring={(task as any).is_recurring ?? false}
          recurrenceRule={(task as any).recurrence_rule ?? null}
          startDate={task.start_date}
          dueDate={task.due_date}
          recurrenceIndex={(task as any).recurrence_index ?? (task as any).recurrenceIndex ?? 1}
          recurrenceParentId={(task as any).recurrence_parent_id ?? (task as any).recurrenceParentId ?? null}
          canEdit={canEditTaskSettings}
        />
        <EstimateWidget
          taskId={id!}
          estimateValue={(task as any).estimate_value ?? (task as any).estimateValue}
          estimateUnit={(task as any).estimate_unit ?? (task as any).estimateUnit}
          canEdit={canEditTaskSettings}
        />
        <TimeLogWidget taskId={id!} sessionMinutes={(task as any).total_logged_minutes ?? (task as any).totalLoggedMinutes ?? 0} />
        <DependenciesWidget taskId={id!} departmentId={task.department_id} canEdit={canEditTaskSettings} />
        <CustomFieldsWidget
          taskId={id!}
          departmentId={task.department_id}
          existingValues={(task as any).customFieldValues ?? (task as any).custom_field_values}
          canEdit={canEditTaskSettings}
        />

        <div className="neu-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-600 bg-white dark:bg-slate-900 text-emerald-600 shadow-neu-sm">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Subtasks
                  </h2>
                  {subtasks?.items?.length ? (
                    <span className="rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-600 px-2 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                      {subtasks.items.length}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Child work items &amp; checklist</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-medium shrink-0 pt-1">
              {canManageSubtasks ? 'Manage child items' : 'View only'}
            </span>
          </div>

          {/* Subtask progress bar */}
          {(() => {
            const total = subtasks?.items?.length ?? 0;
            const done = subtasks?.items?.filter((s: any) =>
              s.status?.category === 'done' || s.status?.key === 'done'
            ).length ?? 0;
            if (total === 0) return null;
            const pct = Math.round((done / total) * 100);
            return (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {done} of {total} completed
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <ul className="mb-3 space-y-1.5">
            {subtasks?.items?.map((s: any) => {
              const isDone = s.status?.category === 'done' || s.status?.key === 'done';
              return (
                <li key={s.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800/80 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isDone
                          ? 'bg-white dark:bg-slate-900 border-emerald-600 text-emerald-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isDone && (
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <Link
                      to={`/tasks/${s.id}`}
                      className={`font-medium hover:text-brand-600 dark:hover:text-brand-400 hover:underline truncate ${
                        isDone
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {s.title}
                    </Link>
                    {s.assignee && (
                      <span className="text-xs text-slate-400 shrink-0">({s.assignee.full_name})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status && <Badge label={s.status.label} color={s.status.color} />}
                  </div>
                </li>
              );
            })}
            {subtasks?.items?.length === 0 && <li className="text-sm text-slate-400 dark:text-slate-500">No subtasks.</li>}
          </ul>

          {canManageSubtasks && (
            <form onSubmit={handleCreateSubtask} className="flex gap-2">
              <input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="New subtask title…"
                className="flex-1 neu-input"
              />
              <button
                type="submit"
                disabled={createTask.isPending || !newSubtaskTitle.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 shadow-neu-sm transition-all disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Add subtask
              </button>
            </form>
          )}
        </div>

        <div className="neu-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-blue-600 bg-white dark:bg-slate-900 text-blue-600 shadow-neu-sm">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Comments &amp; Discussion
                  </h2>
                  {comments?.length ? (
                    <span className="rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 px-2 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-300 shadow-2xs">
                      {comments.length}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Team collaboration &amp; mentions</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {comments?.map((c: any) => {
              const isOwnComment = c.author?.id === currentUser?.id || c.author_id === currentUser?.id;
              const canDeleteThis = isOwnComment || isManagerOrAdmin;
              const isEditing = editingCommentId === c.id;
              return (
                <div key={c.id} className="group rounded-md bg-slate-50 dark:bg-slate-950 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    {c.author && (
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{c.author.full_name}</p>
                    )}
                    <div className="flex items-center gap-1">
                      {isOwnComment && !isEditing && (
                        <button
                          type="button"
                          title="Edit comment"
                          onClick={() => {
                            setEditingCommentId(c.id);
                            setEditingCommentBody(c.body.replace(/<[^>]*>?/gm, ''));
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {canDeleteThis && !isEditing && (
                        <button
                          type="button"
                          title="Delete comment"
                          onClick={() => {
                            if (window.confirm('Delete this comment? This cannot be undone.')) {
                              deleteComment.mutate(c.id);
                            }
                          }}
                          disabled={deleteComment.isPending}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingCommentBody}
                        onChange={(e) => setEditingCommentBody(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCommentId(null)}
                          className="rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={updateComment.isPending || !editingCommentBody.trim()}
                          onClick={async () => {
                            await updateComment.mutateAsync({ commentId: c.id, body: editingCommentBody.trim() });
                            setEditingCommentId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border-2 border-blue-600 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 shadow-neu-sm disabled:opacity-50"
                        >
                          {updateComment.isPending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="prose dark:prose-invert prose-sm max-w-none text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{ __html: c.body }}
                      />
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                        {c.updated_at && c.updated_at !== c.created_at && (
                          <span className="text-[10px] text-slate-400 font-medium">(edited)</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {comments?.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No comments yet.</p>}
          </div>
          <form onSubmit={handleAddComment} className="mt-3 space-y-2">
            <RichTextEditor
              key={commentKey}
              content={commentBody}
              onChange={(html) => setCommentBody(html)}
              placeholder="Add a comment… use @ to mention someone"
              compact
              members={(members as { id: string; full_name: string }[] | undefined) ?? []}
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addComment.isPending || !commentBody || commentBody === '<p></p>'}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-blue-600 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-neu-sm transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-blue-600" />
                Post
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Collapsible Activity Panel */}
      {activityOpen && (
        <div className="neu-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-600 bg-white dark:bg-slate-900 text-slate-600 shadow-neu-sm">
                <History className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activity Log</h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Audit trail &amp; change history</p>
              </div>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            {activity?.map((a: any) => (
              <li key={a.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                <span className="font-medium text-slate-700 dark:text-slate-300">{a.action}</span>
                <span className="ml-2">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
            {activity?.length === 0 && <li className="text-slate-400">No activity yet.</li>}
          </ul>
        </div>
      )}

      </div>{/* close grid */}

      {/* Request Archive / Delete Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md neu-card shadow-xl animate-pop-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {requestActionType === 'archive' ? 'Request to Archive Task' : 'Request to Delete Task'}
              </h3>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {requestActionType === 'archive'
                ? 'Employees cannot directly archive tasks. This request will be routed to your manager for review.'
                : 'Permanent deletion permanently removes the task from the database. This request requires manager approval.'}
            </p>
            <form onSubmit={handleSubmitActionRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Note (optional)
                </label>
                <textarea
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Explain why this task should be archived or deleted…"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-neu-sm transition-all disabled:opacity-50 border-2 ${
                    requestActionType === 'archive'
                      ? 'border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      : 'border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                  }`}
                >
                  {requestSubmitting ? 'Submitting…' : `Submit ${requestActionType === 'archive' ? 'Archive' : 'Delete'} Request`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
