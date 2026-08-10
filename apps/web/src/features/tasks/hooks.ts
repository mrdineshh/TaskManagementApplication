import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.tasks.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
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
    },
  });
}

export function useTransitionTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toStatusId: string) => apiClient.tasks.transition(id, toStatusId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      qc.invalidateQueries({ queryKey: ['tasks', id, 'activity'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiClient.tasks.addComment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id, 'comments'] }),
  });
}

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: () => apiClient.departments.list() });
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
