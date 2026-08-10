import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';

// --- Departments ---
export function useDepartmentsAdmin() {
  return useQuery({ queryKey: ['departments'], queryFn: () => apiClient.departments.list() });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) => apiClient.departments.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.departments.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

// --- Roles ---
export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: () => apiClient.roles.list() });
}
export function usePermissionKeys() {
  return useQuery({ queryKey: ['permissions'], queryFn: () => apiClient.roles.permissions() });
}
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; department_id?: string | null; permission_keys?: string[] }) =>
      apiClient.roles.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.roles.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.roles.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

// --- Users ---
export function useUsersAdmin() {
  return useQuery({ queryKey: ['admin-users'], queryFn: () => apiClient.users.list() });
}
export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; full_name: string; primary_department_id: string; role_ids?: string[] }) =>
      apiClient.users.invite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.users.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.users.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, departmentId }: { userId: string; roleId: string; departmentId?: string }) =>
      apiClient.roles.assignToUser(userId, roleId, departmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
export function useRemoveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => apiClient.roles.removeFromUser(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

// --- Custom fields ---
export function useCustomFieldsAdmin(departmentId?: string) {
  return useQuery({ queryKey: ['custom-fields', departmentId], queryFn: () => apiClient.customFields.list(departmentId) });
}
export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.customFields.create(data as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}
export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.customFields.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}
export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.customFields.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}

// --- Workflows ---
export function useWorkflowsAdmin() {
  return useQuery({ queryKey: ['workflows'], queryFn: () => apiClient.workflows.list() });
}
export function useWorkflowStatusesAdmin(workflowId?: string) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'statuses'],
    queryFn: () => apiClient.workflows.statuses(workflowId!),
    enabled: !!workflowId,
  });
}
export function useWorkflowTransitionsAdmin(workflowId?: string) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'transitions'],
    queryFn: () => apiClient.workflows.transitions(workflowId!),
    enabled: !!workflowId,
  });
}
export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; department_id?: string | null; is_default?: boolean }) => apiClient.workflows.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useAddStatus(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.workflows.addStatus(workflowId, data as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', workflowId, 'statuses'] }),
  });
}
export function useUpdateStatus(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.workflows.updateStatus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', workflowId, 'statuses'] }),
  });
}
export function useRemoveStatus(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.workflows.removeStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', workflowId, 'statuses'] }),
  });
}
export function useAddTransition(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { from_status_id: string; to_status_id: string; required_permission?: string | null }) =>
      apiClient.workflows.addTransition(workflowId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', workflowId, 'transitions'] }),
  });
}
export function useRemoveTransition(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.workflows.removeTransition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', workflowId, 'transitions'] }),
  });
}

// --- Priorities ---
export function usePrioritiesAdmin() {
  return useQuery({ queryKey: ['priorities-admin'], queryFn: () => apiClient.priorities.list() });
}
export function useCreatePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.priorities.create(data as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priorities-admin'] }),
  });
}
export function useUpdatePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.priorities.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priorities-admin'] }),
  });
}
export function useDeletePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.priorities.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priorities-admin'] }),
  });
}

// --- Integration settings ---
export function useIntegrationSetting(key: string) {
  return useQuery({ queryKey: ['integration-settings', key], queryFn: () => apiClient.integrationSettings.get(key) });
}
export function useUpsertIntegrationSetting(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ config, secret }: { config: Record<string, unknown>; secret?: string }) =>
      apiClient.integrationSettings.upsert(key, config, secret),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integration-settings', key] }),
  });
}
export function useTestIntegrationSetting(key: string) {
  return useMutation({ mutationFn: () => apiClient.integrationSettings.test(key) });
}

// --- Organization ---
export function useOrganizationSettings() {
  return useQuery({ queryKey: ['organization-settings'], queryFn: () => apiClient.organization.get() });
}
export function useUpdateOrganizationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.organization.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization-settings'] }),
  });
}
