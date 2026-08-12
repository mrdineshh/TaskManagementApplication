import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EffectivePermissions {
  permissionKeys: string[];
  /** Departments this user's role grants are scoped to (empty when hasOrgWideRole is true). */
  departmentIds: string[];
  /**
   * True only when the user holds at least one grant that is genuinely unscoped: the Role
   * itself is org-wide (department_id IS NULL, e.g. Admin) AND that specific UserRole
   * assignment has no departmentOverride narrowing it. A generic, reusable role template
   * (e.g. the seeded "Employee" role, which also has department_id NULL so it can be
   * assigned across departments) is NOT org-wide by itself — per 02-DATA-MODEL.md §2.4,
   * UserRole.departmentOverride is exactly the mechanism that narrows that per assignment.
   * Getting this wrong silently bypasses department scoping for every non-admin user.
   */
  hasOrgWideRole: boolean;
}

/**
 * Computes a user's effective permission set across all assigned roles
 * (docs/03-RBAC-AUTH.md §2.1, §2.4). Recomputed on login/token-refresh and
 * embedded in the JWT so guards don't hit the DB on every request.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const permissionKeys = new Set<string>();
    const scopedDepartmentIds = new Set<string>();
    let hasOrgWideRole = false;

    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }

      if (ur.role.departmentId !== null) {
        // Role definition itself is pinned to one department (e.g. a real "Sales Manager" role).
        scopedDepartmentIds.add(ur.role.departmentId);
      } else if (ur.departmentOverride !== null) {
        // Generic role template, narrowed to one department for this specific assignment.
        scopedDepartmentIds.add(ur.departmentOverride);
      } else {
        // Neither the role nor the assignment narrows scope — genuinely org-wide (e.g. Admin).
        hasOrgWideRole = true;
      }
    }

    if (!hasOrgWideRole && scopedDepartmentIds.size === 0) {
      // No role granted any scope at all (e.g. a brand-new user with no department-scoped
      // role assignment yet) — fall back to the user's own primary/linked departments so
      // they aren't accidentally treated as org-wide by an empty scope set.
      const userDepartments = await this.prisma.userDepartment.findMany({ where: { userId } });
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      userDepartments.forEach((d) => scopedDepartmentIds.add(d.departmentId));
      if (user) scopedDepartmentIds.add(user.primaryDepartmentId);
    }

    return {
      permissionKeys: [...permissionKeys],
      departmentIds: hasOrgWideRole ? [] : [...scopedDepartmentIds],
      hasOrgWideRole,
    };
  }
}
