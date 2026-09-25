import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';
import { toast } from '../../lib/toast/toast-store';

// Real-time polling intervals — tasks refresh every 8s so any change made
// by another user (new task, status transition, assignment) appears automatically.
const TASK_POLL_MS = 8_000;
const DASHBOARD_POLL_MS = 15_000;

export function useTasks(params?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => apiClient.tasks.list(params),
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useTimesheetRows(params?: { department_id?: string; from?: string; to?: string; user_id?: string }) {
  return useQuery({
    queryKey: ['tasks', 'timesheet', params],
    queryFn: () => apiClient.tasks.timesheetRows(params),
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useEmployeeTimesheetDetail(
  userId: string | undefined,
  params?: { department_id?: string; from?: string; to?: string },
) {
  return useQuery({
    queryKey: ['tasks', 'timesheet', 'employee', userId, params],
    queryFn: () => apiClient.tasks.employeeTimesheetDetail(userId!, params),
    enabled: !!userId,
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => apiClient.tasks.get(id!),
    enabled: !!id,
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useTaskActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id, 'activity'],
    queryFn: () => apiClient.tasks.activity(id!),
    enabled: !!id,
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useTaskComments(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id, 'comments'],
    queryFn: () => apiClient.tasks.comments(id!),
    enabled: !!id,
    refetchInterval: TASK_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.tasks.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Task created');
    },
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.tasks.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
    },
  });
}

export function useAssignTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: string | null) => apiClient.tasks.assign(id, assigneeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task assigned');
    },
  });
}

export function useTransitionTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ toStatusId, onHoldReasonId }: { toStatusId: string; onHoldReasonId?: string }) =>
      apiClient.tasks.transition(id, toStatusId, onHoldReasonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Status updated');
    },
  });
}

// --- Phase 2: effort estimation (docs/10-OPEN-DECISIONS.md §H2) ---
export function useSubmitEstimate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, unit }: { value: number; unit: 'hours' | 'days' }) => apiClient.tasks.submitEstimate(id, value, unit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'activity'] });
      toast.success('Estimate submitted');
    },
  });
}

export function useOnHoldReasons() {
  return useQuery({ queryKey: ['on-hold-reasons'], queryFn: () => apiClient.onHoldReasons.list() });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiClient.tasks.addComment(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id, 'comments'] });
      toast.success('Comment added');
    },
  });
}

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: () => apiClient.departments.list() });
}

/** Department members, for the assignee picker on task creation/detail (docs/10-OPEN-DECISIONS.md §M7).
 * Pass fetchAll=true for Admins/Managers who have org-wide scope and no department restriction. */
export function useUsers(departmentId?: string, fetchAll = false) {
  return useQuery({
    queryKey: ['users', fetchAll ? 'all' : (departmentId ?? 'all')],
    queryFn: () => apiClient.users.list({ department_id: fetchAll ? undefined : departmentId, is_active: true }),
    // Always enabled for org-wide users (fetchAll=true); otherwise only when a department is selected.
    enabled: fetchAll || !!departmentId,
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      apiClient.comments.edit(commentId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiClient.comments.remove(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
      toast.success('Comment deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePriorities(departmentId?: string) {
  return useQuery({
    queryKey: ['priorities', departmentId],
    queryFn: () => apiClient.priorities.list(departmentId),
  });
}

export function useWorkflows() {
  return useQuery({ queryKey: ['workflows'], queryFn: () => apiClient.workflows.list() });
}

export function useWorkflowStatuses(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'statuses'],
    queryFn: () => apiClient.workflows.statuses(workflowId!),
    enabled: !!workflowId,
  });
}

export function useWorkflowTransitions(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'transitions'],
    queryFn: () => apiClient.workflows.transitions(workflowId!),
    enabled: !!workflowId,
  });
}

export function usePersonalDashboard() {
  return useQuery({
    queryKey: ['dashboards', 'personal'],
    queryFn: () => apiClient.dashboards.personal(),
    refetchInterval: DASHBOARD_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useDepartmentDashboard(departmentId: string | undefined) {
  return useQuery({
    queryKey: ['dashboards', 'department', departmentId],
    queryFn: () => apiClient.dashboards.department(departmentId!),
    enabled: !!departmentId,
    refetchInterval: DASHBOARD_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

/** Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K) — same query, different shape per active role. */
export function useTeamDashboard(departmentId?: string) {
  return useQuery({
    queryKey: ['dashboards', 'team', departmentId],
    queryFn: () => apiClient.dashboards.team(departmentId),
    refetchInterval: DASHBOARD_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

// --- Phase 4: employee scorecard + department leaderboard ---

export function useMyScorecard(start: string, end: string) {
  return useQuery({
    queryKey: ['scorecards', 'me', start, end],
    queryFn: () => apiClient.scorecards.me(start, end),
  });
}

export function useUserScorecard(userId: string | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ['scorecards', 'users', userId, start, end],
    queryFn: () => apiClient.scorecards.forUser(userId!, start, end),
    enabled: !!userId,
  });
}

export function useLeaderboard(departmentId: string | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ['scorecards', 'leaderboard', departmentId, start, end],
    queryFn: () => apiClient.scorecards.leaderboard(departmentId!, start, end),
    enabled: !!departmentId,
  });
}

export function useScorecardConfig() {
  return useQuery({ queryKey: ['scorecards', 'config'], queryFn: () => apiClient.scorecards.getConfig() });
}

export function useUpdateScorecardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weights: Parameters<typeof apiClient.scorecards.updateConfig>[0]) => apiClient.scorecards.updateConfig(weights),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scorecards', 'config'] });
      toast.success('Scorecard weights saved');
    },
  });
}

// --- v1.1: time tracking, dependencies, approvals ---

export function useTimeLogs(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', id, 'time-logs'], queryFn: () => apiClient.tasks.timeLogs(id!), enabled: !!id });
}

export function useAddTimeLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ minutes, note, loggedAt }: { minutes: number; note?: string; loggedAt?: string }) =>
      apiClient.tasks.addTimeLog(id, minutes, note, loggedAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Time logged');
    },
  });
}

/** 30-minute self-edit window + Admin override, enforced server-side (docs/10-OPEN-DECISIONS.md §H3). */
export function useUpdateTimeLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, data }: { logId: string; data: { minutes?: number; note?: string; logged_at?: string } }) =>
      apiClient.tasks.updateTimeLog(id, logId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Time log updated');
    },
  });
}

export function useTaskDependencies(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', id, 'dependencies'], queryFn: () => apiClient.tasks.dependencies(id!), enabled: !!id });
}

export function useAddDependency(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dependsOnTaskId, type }: { dependsOnTaskId: string; type: 'blocks' | 'relates_to' }) =>
      apiClient.tasks.addDependency(id, dependsOnTaskId, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id, 'dependencies'] });
      toast.success('Dependency added');
    },
  });
}

export function useRemoveDependency(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => apiClient.tasks.removeDependency(id, depId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id, 'dependencies'] });
      toast.success('Dependency removed');
    },
  });
}

export function useApprovalSteps(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', id, 'approval-steps'], queryFn: () => apiClient.tasks.approvalSteps(id!), enabled: !!id });
}

export function useDecideApprovalStep(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, decision, comment }: { stepId: string; decision: 'approved' | 'rejected'; comment?: string }) =>
      apiClient.approvalSteps.decide(stepId, decision, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'approval-steps'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'activity'] });
      toast.success('Approval decision recorded');
    },
  });
}

/** Manager approve / request-changes on a review-status task with optional reference attachments. */
export function useReviewAction(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      comment,
      attachments,
    }: {
      action: 'approve' | 'request_changes';
      comment?: string;
      attachments?: { file_name: string; mime_type: string; size_bytes: number; content_base64: string }[];
    }) => apiClient.tasks.reviewAction(taskId, action, comment, attachments),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'reviews'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success(vars.action === 'approve' ? 'Task approved ✓' : 'Changes requested — employee notified');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Fetches formal review records (feedback and reference attachments) for a task. */
export function useTaskReviews(taskId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', taskId, 'reviews'],
    queryFn: () => apiClient.tasks.getReviews(taskId!),
    enabled: !!taskId,
  });
}

/** Allows employee to resubmit their task for review once changes are completed. */
export function useResubmitReview(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => apiClient.tasks.resubmitReview(taskId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'reviews'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task resubmitted for manager review');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Employee clock-out — banks active session time and pauses the timer while keeping the task In Progress. */
export function useClockOut(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.tasks.clockOut(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Clocked out — session time banked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Employee clock-in — starts or resumes the live session timer on an In Progress task. */
export function useClockIn(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.tasks.clockIn(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'time-logs'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Clocked in — timer running');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Archive a task (soft delete via deletedAt) — manager/head/admin only. */
export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.tasks.archive(taskId),
    onSuccess: (_res, taskId) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', 'archived'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Task archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Unarchive a task (restores deletedAt to null). */
export function useUnarchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.tasks.unarchive(taskId),
    onSuccess: (_res, taskId) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', 'archived'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Task unarchived and restored');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Permanently delete a task from the database — permanent & irreversible. */
export function usePermanentDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.tasks.permanentDelete(taskId),
    onSuccess: (_res, taskId) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', 'archived'] });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Task permanently deleted from database');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Query archived tasks (for Settings). */
export function useArchivedTasks(departmentId?: string, query?: string) {
  return useQuery({
    queryKey: ['tasks', 'archived', { departmentId, query }],
    queryFn: () => apiClient.tasks.listArchived({ department_id: departmentId, q: query }),
  });
}

/** Submit an archive or delete request — used by employees. */
export function useCreateTaskActionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, actionType, reason }: { taskId: string; actionType: 'archive' | 'delete'; reason?: string }) =>
      apiClient.tasks.requestAction(taskId, actionType, reason),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', vars.taskId, 'action-request'] });
      qc.invalidateQueries({ queryKey: ['task-action-requests'] });
      toast.success(`Request to ${vars.actionType} task submitted to manager`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Get current pending action request on a specific task. */
export function useTaskActionRequest(taskId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', taskId, 'action-request'],
    queryFn: () => apiClient.tasks.getActionRequest(taskId!),
    enabled: !!taskId,
  });
}

/** List all pending action requests for manager review. */
export function usePendingActionRequests() {
  return useQuery({
    queryKey: ['task-action-requests', 'pending'],
    queryFn: () => apiClient.tasks.listPendingActionRequests(),
  });
}

/** Approve or reject an action request. */
export function useDecideTaskActionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, decision, reviewerNote }: { requestId: string; decision: 'approved' | 'rejected'; reviewerNote?: string }) =>
      apiClient.tasks.decideActionRequest(requestId, decision, reviewerNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'archived'] });
      qc.invalidateQueries({ queryKey: ['task-action-requests'] });
      toast.success('Action request decided');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Submit a bug report — any authenticated user can file one. Stored in DB, not shown in UI. */
export function useSubmitBugReport() {
  return useMutation({
    mutationFn: ({ description, pageUrl, screenshotBase64 }: { description: string; pageUrl?: string; screenshotBase64?: string }) =>
      apiClient.bugReports.submit(description, pageUrl, screenshotBase64),
    onSuccess: () => {
      toast.success('Bug report submitted. Thank you!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}


