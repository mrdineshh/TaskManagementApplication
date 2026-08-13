import { z } from 'zod';

/**
 * Illustrative permission-key summary per 03-RBAC-AUTH.md §2.1. The API's guarded
 * endpoints are the definitive source (04-API-SPEC.md); keep this list in sync with it.
 * New keys are added as new features ship — v1.1/v1.2 keys are marked below.
 */
export const permissionKeys = [
  'task.create',
  'task.view',
  'task.edit',
  'task.delete',
  'task.assign',
  'task.comment',
  'task.moderate',
  'department.view',
  'department.manage',
  'user.view',
  'user.manage',
  'role.manage',
  'custom_field.view',
  'custom_field.manage',
  'workflow.view',
  'workflow.manage',
  'priority.view',
  'priority.manage',
  'integration_settings.manage',
  // Not explicitly listed in docs/03-RBAC-AUTH.md §2.1 — added for the org settings screen
  // (docs/06-FRONTEND-WEB.md §3 /admin/settings) per docs/00-OVERVIEW.md §5's guidance that
  // gaps get a reasonable default rather than blocking the build.
  'organization.manage',
  // Not explicitly listed either — 05-FEATURES.md §2.2 describes Admins defining SLA
  // policies but 03-RBAC-AUTH.md §2.1's list doesn't enumerate an sla.* key. Same
  // reasonable-default-over-blocking treatment as organization.manage above.
  'sla.view',
  'sla.manage',
  'report.view',
  'report.create',
  'report.export',
  'report.manage',
  'approval.approve', // v1.1
] as const;
export type PermissionKey = (typeof permissionKeys)[number];

export interface Permission {
  id: string;
  key: PermissionKey | string;
  description: string;
}

/**
 * System roles seeded at launch per 03-RBAC-AUTH.md §2.2. Only 'Admin' is protected from
 * deletion. 'Head' and 'Management' added per docs/10-OPEN-DECISIONS.md §G1/§G3 — 'Head' is a
 * department-scoped role like 'Manager' (assigned via UserRole.departmentOverride to whichever
 * department their Department.headUserId points at), with a permission bundle equal to
 * Manager's; what actually differs is the *scope* of what they query (whole department vs. only
 * direct reports), computed in application logic, not by a distinct permission key. 'Management'
 * is a genuinely org-wide role (no departmentOverride) reusing the RBAC system's existing
 * hasOrgWideRole mechanism for cross-department visibility — granted every viewing permission
 * but none of the *.manage keys, which stay Admin-only.
 */
export const SYSTEM_ROLE_NAMES = ['Admin', 'Management', 'Head', 'Manager', 'Employee'] as const;

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  department_id: z.string().uuid().nullable().default(null),
  permission_keys: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema.partial();
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const assignRoleSchema = z.object({
  role_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
