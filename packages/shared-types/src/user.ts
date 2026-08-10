import { z } from 'zod';
import type { ISODateString } from './common';

export const authProviders = ['google', 'sso'] as const;
export type AuthProviderName = (typeof authProviders)[number];

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  primary_department_id: string;
  auth_provider: AuthProviderName;
  is_active: boolean;
  last_login_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/** Additional non-primary departments a user is linked to (UserDepartment join). */
export interface UserWithDepartments extends User {
  department_ids: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  department_id: string | null;
}

export interface RoleWithPermissions extends Role {
  permission_keys: string[];
}

export interface CurrentUser extends User {
  roles: Role[];
  /** Effective, flattened permission set across all assigned roles — see 03-RBAC-AUTH.md §2.4. */
  permissions: string[];
}

export const inviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  primary_department_id: z.string().uuid(),
  role_ids: z.array(z.string().uuid()).default([]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  primary_department_id: z.string().uuid().optional(),
  department_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateOwnProfileSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  avatar_url: z.string().url().optional(),
});
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
