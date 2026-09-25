import { ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';

/**
 * Department-scoping enforcement per docs/03-RBAC-AUTH.md §2.1/§2.5: a
 * department-scoped role only ever sees/acts on data within its department(s).
 * Org-wide roles (hasOrgWideRole) bypass this. Applied at the query/service
 * layer, never left to the client.
 */
export function assertDepartmentScope(
  user: AccessTokenPayload,
  resourceDepartmentId: string,
  allowedUserId?: string | null,
): void {
  if (user.hasOrgWideRole) return;
  if (allowedUserId && allowedUserId === user.sub) return;
  if (!user.departmentIds.includes(resourceDepartmentId)) {
    throw new ForbiddenException('Outside your department scope');
  }
}

/** Returns a Prisma `where` fragment scoping department_id to the user's departments, or allows tasks assigned to the user. */
export function departmentScopeWhere(user: AccessTokenPayload) {
  return user.hasOrgWideRole
    ? {}
    : {
        OR: [
          { departmentId: { in: user.departmentIds } },
          { assigneeId: user.sub },
        ],
      };
}

