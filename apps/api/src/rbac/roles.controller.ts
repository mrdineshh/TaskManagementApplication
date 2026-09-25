import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from './dto/rbac.dto';
import { NotificationsService } from '../notifications/notifications.service';

/** Roles & Permissions — the RBAC configuration surface (docs/04-API-SPEC.md §4). */
@ApiTags('rbac')
@Controller()
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('roles')
  @RequirePermission('role.manage')
  async list() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map(this.toDto);
  }

  @Get('roles/:id')
  @RequirePermission('role.manage')
  async get(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.toDto(role);
  }

  @Post('roles')
  @RequirePermission('role.manage')
  async create(@Body() dto: CreateRoleDto) {
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.department_id ?? null,
      },
    });
    if (dto.permission_keys?.length) {
      await this.setPermissions(role.id, dto.permission_keys);
    }
    return this.get(role.id);
  }

  @Patch('roles/:id')
  @RequirePermission('role.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.department_id === undefined ? undefined : dto.department_id,
      },
    });
    if (dto.permission_keys) {
      await this.setPermissions(id, dto.permission_keys);
    }
    return this.get(id);
  }

  @Delete('roles/:id')
  @RequirePermission('role.manage')
  async remove(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole && role.name === 'Admin') {
      throw new BadRequestException('The Admin system role cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  @Get('permissions')
  @RequirePermission('role.manage')
  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  @Post('users/:id/roles')
  @RequirePermission('role.manage')
  async assignToUser(@Param('id') userId: string, @Body() dto: AssignRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
    if (!role) throw new NotFoundException('Role not found');

    // Admin is genuinely org-wide: no department override. Other roles use the provided or user's department.
    const departmentOverride = role.name === 'Admin' ? null : (dto.department_id ?? null);

    const userRole = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: dto.role_id } },
      update: { departmentOverride },
      create: { userId, roleId: dto.role_id, departmentOverride },
    });

    // If assigning a non-Employee role, clean up default Employee role so new role is active
    if (role.name !== 'Employee') {
      const employeeRole = await this.prisma.role.findFirst({ where: { name: 'Employee' } });
      if (employeeRole) {
        await this.prisma.userRole.deleteMany({
          where: { userId, roleId: employeeRole.id },
        });
      }
    }

    // Stamp the user's role_changed_at so the frontend can detect a stale session
    // and prompt a re-login to pick up the new permissions in the JWT.
    await this.prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() },
    }).catch(() => {});

    // Notify the affected user of their new role.
    const department = departmentOverride
      ? await this.prisma.department.findUnique({ where: { id: departmentOverride }, select: { name: true } })
      : null;
    await this.notifications
      .notify(userId, 'role_assigned', {
        roleName: role.name,
        departmentName: department?.name ?? null,
      })
      .catch(() => {});

    return userRole;
  }

  @Delete('users/:id/roles/:roleId')
  @RequirePermission('role.manage')
  async removeFromUser(@Param('id') userId: string, @Param('roleId') roleId: string) {
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });

    // Notify the affected user that their role was revoked.
    const revokedRole = await this.prisma.role.findUnique({ where: { id: roleId }, select: { name: true } }).catch(() => null);
    if (revokedRole) {
      await this.notifications
        .notify(userId, 'role_revoked', { roleName: revokedRole.name })
        .catch(() => {});
    }

    // Stamp updatedAt so the frontend can detect a stale session.
    await this.prisma.user.update({ where: { id: userId }, data: { updatedAt: new Date() } }).catch(() => {});

    // Fallback: If the user has no remaining roles, assign Employee role in their primary department
    const remainingRoles = await this.prisma.userRole.count({ where: { userId } });
    if (remainingRoles === 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const employeeRole = await this.prisma.role.findFirst({ where: { name: 'Employee' } });
      if (user && employeeRole) {
        await this.prisma.userRole.create({
          data: {
            userId,
            roleId: employeeRole.id,
            departmentOverride: user.primaryDepartmentId,
          },
        });
      }
    }
    return { success: true };
  }

  private async setPermissions(roleId: string, permissionKeys: string[]) {
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  private toDto(role: {
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    departmentId: string | null;
    permissions: { permission: { key: string } }[];
  }) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      is_system_role: role.isSystemRole,
      department_id: role.departmentId,
      permission_keys: role.permissions.map((p) => p.permission.key),
    };
  }
}
