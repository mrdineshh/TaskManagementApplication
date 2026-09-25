import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_NAMES, permissionKeys } from '@taskapp/shared-types';

/**
 * Priority order (highest first) for picking a default active role when the user hasn't
 * explicitly toggled one (docs/10-OPEN-DECISIONS.md §G3/§K) — highest-privilege held role
 * wins, so a brand-new multi-role user lands somewhere sensible rather than on whichever
 * role happened to be assigned first. SYSTEM_ROLE_NAMES is already declared in this order.
 */
const ROLE_PRIORITY: readonly string[] = SYSTEM_ROLE_NAMES;

const MANAGER_PERMISSIONS = [
  'task.create',
  'task.view',
  'task.edit',
  'task.delete',
  'task.assign',
  'task.comment',
  'task.moderate',
  'department.view',
  'user.view',
  'custom_field.view',
  'workflow.view',
  'priority.view',
  'sla.view',
  'report.view',
  'report.create',
  'report.export',
  'holiday_calendar.view',
  'on_hold_reason.view',
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  Admin: permissionKeys,
  Management: [
    'task.view',
    'department.view',
    'user.view',
    'custom_field.view',
    'workflow.view',
    'priority.view',
    'sla.view',
    'report.view',
    'report.create',
    'report.export',
    'holiday_calendar.view',
    'on_hold_reason.view',
  ],
  Head: MANAGER_PERMISSIONS,
  Manager: MANAGER_PERMISSIONS,
  Employee: [
    'task.create',
    'task.view',
    'task.edit',
    'task.assign',
    'task.comment',
    'department.view',
    'user.view',
    'custom_field.view',
    'workflow.view',
    'priority.view',
    'on_hold_reason.view',
    'holiday_calendar.view',
  ],
};

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
export class RbacService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      // 1. Ensure all permission keys exist
      for (const key of permissionKeys) {
        await this.prisma.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
        });
      }

      // 2. Initialize default system roles and permissions only if role does not yet exist
      for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
        const existingRole = await this.prisma.role.findFirst({ where: { name } });
        if (!existingRole) {
          const createdRole = await this.prisma.role.create({
            data: { name, isSystemRole: name === 'Admin' },
          });
          const perms = await this.prisma.permission.findMany({
            where: { key: { in: [...keys] } },
          });
          await this.prisma.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: createdRole.id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      }

      // 3. Ensure sujeeth.k@econz.net has Admin role assigned
      const adminUser = await this.prisma.user.findUnique({ where: { email: 'sujeeth.k@econz.net' } });
      if (adminUser) {
        const adminRole = await this.prisma.role.findFirst({ where: { name: 'Admin' } });
        if (adminRole) {
          const hasAdmin = await this.prisma.userRole.findFirst({
            where: { userId: adminUser.id, roleId: adminRole.id },
          });
          if (!hasAdmin) {
            await this.prisma.userRole.create({
              data: { userId: adminUser.id, roleId: adminRole.id, departmentOverride: null },
            });
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('RBAC bootstrap sync notice:', err);
    }
  }

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

  /**
   * Which role the app should be "framed around" right now (docs/10-OPEN-DECISIONS.md §G3):
   * the user's explicitly toggled `activeRoleId` if it's still one they actually hold,
   * otherwise the highest-priority role among everything they hold, otherwise null (no
   * system role assigned at all — shouldn't happen for an invited user, but not fatal).
   * Head and Manager carry an identical permission bundle (§G1) — this is the only place
   * that distinguishes them, by role *name*, for scope decisions in application logic
   * rather than a permission key.
   */
  async resolveActiveRoleName(userId: string): Promise<string | null> {
    const [user, userRoles] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { activeRoleId: true } }),
      this.prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
    ]);

    if (user?.activeRoleId) {
      const active = userRoles.find((ur) => ur.roleId === user.activeRoleId);
      if (active) return active.role.name;
    }

    const heldNames = new Set(userRoles.map((ur) => ur.role.name));
    return ROLE_PRIORITY.find((name) => heldNames.has(name)) ?? null;
  }
}
