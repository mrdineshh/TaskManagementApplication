import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';
import { toast } from '../../lib/toast/toast-store';

export function useTasks(params?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => apiClient.tasks.list(params),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => apiClient.tasks.get(id!),
    enabled: !!id,
  });
}

export function useTaskActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id, 'activity'],
    queryFn: () => apiClient.tasks.activity(id!),
    enabled: !!id,
  });
}

export function useTaskComments(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id, 'comments'],
    queryFn: () => apiClient.tasks.comments(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.tasks.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
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

/** Department members, for the assignee picker on task creation/detail (docs/10-OPEN-DECISIONS.md §M7). */
export function useUsers(departmentId?: string) {
  return useQuery({
    queryKey: ['users', departmentId],
    queryFn: () => apiClient.users.list({ department_id: departmentId, is_active: true }),
    enabled: !!departmentId,
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
  return useQuery({ queryKey: ['dashboards', 'personal'], queryFn: () => apiClient.dashboards.personal() });
}

export function useDepartmentDashboard(departmentId: string | undefined) {
  return useQuery({
    queryKey: ['dashboards', 'department', departmentId],
    queryFn: () => apiClient.dashboards.department(departmentId!),
    enabled: !!departmentId,
  });
}

/** Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K) — same query, different shape per active role. */
export function useTeamDashboard(departmentId?: string) {
  return useQuery({
    queryKey: ['dashboards', 'team', departmentId],
    queryFn: () => apiClient.dashboards.team(departmentId),
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
      qc.invalidateQueries({ queryKey: ['tasks', id, 'time-logs'] });
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
      qc.invalidateQueries({ queryKey: ['tasks', id, 'time-logs'] });
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
