import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';

export function useTasks(params?: Record<string, string | undefined>) {
  return useQuery({ queryKey: ['tasks', params], queryFn: () => apiClient.tasks.list(params) });
}

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', id], queryFn: () => apiClient.tasks.get(id!), enabled: !!id });
}

export function useTaskComments(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', id, 'comments'], queryFn: () => apiClient.tasks.comments(id!), enabled: !!id });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiClient.tasks.addComment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id, 'comments'] }),
  });
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

export function useTransitionTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toStatusId: string) => apiClient.tasks.transition(id, toStatusId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
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

/** Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K/§N) — same query, different shape per active role. */
export function useTeamDashboard(departmentId?: string) {
  return useQuery({
    queryKey: ['dashboards', 'team', departmentId],
    queryFn: () => apiClient.dashboards.team(departmentId),
  });
}

// --- Phase 4/§N: employee scorecard + department leaderboard ---

export function useMyScorecard(start: string, end: string) {
  return useQuery({
    queryKey: ['scorecards', 'me', start, end],
    queryFn: () => apiClient.scorecards.me(start, end),
  });
}

/** Leaderboard drill-down (docs/10-OPEN-DECISIONS.md §M5) — same GET /scorecards/users/:id web uses. */
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

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: () => apiClient.departments.list() });
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => apiClient.notifications.list() });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
