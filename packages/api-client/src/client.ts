import type {
  Task,
  TaskWithDetails,
  TaskComment,
  ActivityLogEntry,
  Department,
  CurrentUser,
  Role,
  RoleWithPermissions,
  Permission,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowTransition,
  PriorityDefinition,
  CustomFieldDefinition,
  Notification,
  PaginatedResult,
  ApiErrorBody,
} from '@taskapp/shared-types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (accessToken: string, refreshToken: string) => void;
  /** Called when the refresh token is also invalid/expired — caller should redirect to /login. */
  onAuthFailure: () => void;
}

/**
 * Platform-agnostic typed API client shared by web and mobile (docs/01-ARCHITECTURE.md §4) —
 * both call the same functions (e.g. `tasksApi.list(filters)`); only how tokens are stored
 * differs per platform, injected via ApiClientConfig.
 */
export function createApiClient(config: ApiClientConfig) {
  let refreshInFlight: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = config.getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${config.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { access_token: string; refresh_token: string };
    config.onTokensRefreshed(body.access_token, body.refresh_token);
    return body.access_token;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { skipAuthRetry?: boolean } = {},
  ): Promise<T> {
    const accessToken = config.getAccessToken();
    const res = await fetch(`${config.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !opts.skipAuthRetry) {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      if (newToken) {
        return request<T>(method, path, body, { skipAuthRetry: true });
      }
      config.onAuthFailure();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired');
    }

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        res.status,
        errBody?.error.code ?? 'UNKNOWN_ERROR',
        errBody?.error.message ?? res.statusText,
        errBody?.error.details,
      );
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    auth: {
      google: (token: string) => request<{ access_token: string; refresh_token: string }>('POST', '/auth/google', { token }),
      dev: (token: string) => request<{ access_token: string; refresh_token: string }>('POST', '/auth/dev', { token }),
      logout: () => request<{ success: boolean }>('POST', '/auth/logout'),
    },
    me: {
      get: () => request<CurrentUser & { roles: { id: string; name: string }[] }>('GET', '/me'),
      update: (data: { full_name?: string; avatar_url?: string }) => request('PATCH', '/me', data),
    },
    departments: {
      list: () => request<Department[]>('GET', '/departments'),
      create: (data: { name: string; slug: string; description?: string }) =>
        request<Department>('POST', '/departments', data),
      update: (id: string, data: Partial<{ name: string; description: string; is_active: boolean }>) =>
        request<Department>('PATCH', `/departments/${id}`, data),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/departments/${id}`),
    },
    roles: {
      list: () => request<RoleWithPermissions[]>('GET', '/roles'),
      get: (id: string) => request<RoleWithPermissions>('GET', `/roles/${id}`),
      create: (data: { name: string; description?: string; department_id?: string | null; permission_keys?: string[] }) =>
        request<RoleWithPermissions>('POST', '/roles', data),
      update: (id: string, data: Partial<{ name: string; description: string; department_id: string | null; permission_keys: string[] }>) =>
        request<RoleWithPermissions>('PATCH', `/roles/${id}`, data),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/roles/${id}`),
      permissions: () => request<Permission[]>('GET', '/permissions'),
      assignToUser: (userId: string, roleId: string, departmentId?: string) =>
        request('POST', `/users/${userId}/roles`, { role_id: roleId, department_id: departmentId }),
      removeFromUser: (userId: string, roleId: string) =>
        request<{ success: boolean }>('DELETE', `/users/${userId}/roles/${roleId}`),
    },
    users: {
      list: (params?: { department_id?: string; is_active?: boolean }) =>
        request<unknown[]>(
          'GET',
          `/users${qs({ department_id: params?.department_id, is_active: params?.is_active === undefined ? undefined : String(params.is_active) })}`,
        ),
      get: (id: string) => request<unknown>('GET', `/users/${id}`),
      invite: (data: { email: string; full_name: string; primary_department_id: string; role_ids?: string[] }) =>
        request('POST', '/users', data),
      update: (id: string, data: Record<string, unknown>) => request('PATCH', `/users/${id}`, data),
      deactivate: (id: string) => request<{ success: boolean }>('DELETE', `/users/${id}`),
    },
    workflows: {
      list: () => request<WorkflowDefinition[]>('GET', '/workflows'),
      create: (data: { name: string; department_id?: string | null; is_default?: boolean }) =>
        request<WorkflowDefinition>('POST', '/workflows', data),
      update: (id: string, data: Partial<WorkflowDefinition>) => request<WorkflowDefinition>('PATCH', `/workflows/${id}`, data),
      statuses: (id: string) => request<WorkflowStatus[]>('GET', `/workflows/${id}/statuses`),
      addStatus: (workflowId: string, data: Omit<WorkflowStatus, 'id' | 'workflow_id'>) =>
        request<WorkflowStatus>('POST', `/workflows/${workflowId}/statuses`, data),
      updateStatus: (id: string, data: Partial<WorkflowStatus>) => request<WorkflowStatus>('PATCH', `/statuses/${id}`, data),
      removeStatus: (id: string) => request<{ success: boolean }>('DELETE', `/statuses/${id}`),
      transitions: (workflowId: string) => request<WorkflowTransition[]>('GET', `/workflows/${workflowId}/transitions`),
      addTransition: (workflowId: string, data: { from_status_id: string; to_status_id: string; required_permission?: string | null }) =>
        request<WorkflowTransition>('POST', `/workflows/${workflowId}/transitions`, data),
      removeTransition: (id: string) => request<{ success: boolean }>('DELETE', `/transitions/${id}`),
    },
    priorities: {
      list: (departmentId?: string) => request<PriorityDefinition[]>('GET', `/priorities${qs({ department_id: departmentId })}`),
      create: (data: Omit<PriorityDefinition, 'id' | 'is_active'>) => request<PriorityDefinition>('POST', '/priorities', data),
      update: (id: string, data: Partial<PriorityDefinition>) => request<PriorityDefinition>('PATCH', `/priorities/${id}`, data),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/priorities/${id}`),
    },
    customFields: {
      list: (departmentId?: string) => request<CustomFieldDefinition[]>('GET', `/custom-fields${qs({ department_id: departmentId })}`),
      create: (data: Omit<CustomFieldDefinition, 'id' | 'is_active'>) => request<CustomFieldDefinition>('POST', '/custom-fields', data),
      update: (id: string, data: Partial<CustomFieldDefinition>) => request<CustomFieldDefinition>('PATCH', `/custom-fields/${id}`, data),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/custom-fields/${id}`),
    },
    tasks: {
      list: (params?: Record<string, string | undefined>) => request<PaginatedResult<Task>>('GET', `/tasks${qs(params)}`),
      get: (id: string) => request<TaskWithDetails>('GET', `/tasks/${id}`),
      create: (data: Record<string, unknown>) => request<TaskWithDetails>('POST', '/tasks', data),
      update: (id: string, data: Record<string, unknown>) => request<TaskWithDetails>('PATCH', `/tasks/${id}`, data),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/tasks/${id}`),
      assign: (id: string, assigneeId: string | null) => request<Task>('POST', `/tasks/${id}/assign`, { assignee_id: assigneeId }),
      transition: (id: string, toStatusId: string) => request<Task>('POST', `/tasks/${id}/transition`, { to_status_id: toStatusId }),
      activity: (id: string) => request<ActivityLogEntry[]>('GET', `/tasks/${id}/activity`),
      comments: (id: string) => request<TaskComment[]>('GET', `/tasks/${id}/comments`),
      addComment: (id: string, body: string) => request<TaskComment>('POST', `/tasks/${id}/comments`, { body }),
    },
    comments: {
      edit: (id: string, body: string) => request<TaskComment>('PATCH', `/comments/${id}`, { body }),
      remove: (id: string) => request<{ success: boolean }>('DELETE', `/comments/${id}`),
    },
    notifications: {
      list: (unreadOnly?: boolean) => request<Notification[]>('GET', `/notifications${qs({ unread: unreadOnly ? 'true' : undefined })}`),
      markRead: (id: string) => request<{ success: boolean }>('PATCH', `/notifications/${id}/read`),
      markAllRead: () => request<{ success: boolean }>('PATCH', '/notifications/read-all'),
    },
    dashboards: {
      personal: () => request<Record<string, unknown>>('GET', '/dashboards/personal'),
      department: (departmentId: string) => request<Record<string, unknown>>('GET', `/dashboards/department${qs({ department_id: departmentId })}`),
    },
    integrationSettings: {
      get: (key: string) => request<Record<string, unknown>>('GET', `/integration-settings/${key}`),
      upsert: (key: string, config: Record<string, unknown>, secret?: string) =>
        request('PUT', `/integration-settings/${key}`, { config, secret }),
      test: (key: string) => request<{ success: boolean; message: string }>('POST', `/integration-settings/${key}/test`),
    },
    organization: {
      get: () => request<Record<string, unknown> | null>('GET', '/organization-settings'),
      update: (data: Record<string, unknown>) => request('PATCH', '/organization-settings', data),
    },
  };
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export type ApiClient = ReturnType<typeof createApiClient>;
