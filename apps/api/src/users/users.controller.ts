import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @RequirePermission('user.view')
  async list(
    @Query('department_id') departmentId?: string,
    @Query('is_active') isActive?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(departmentId
          ? {
              OR: [
                { primaryDepartmentId: departmentId },
                { departments: { some: { departmentId } } },
              ],
            }
          : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      include: { departments: true, roles: { include: { role: true } } },
      orderBy: { fullName: 'asc' },
    });
    return users.map(this.toDto);
  }

  @Get(':id')
  @RequirePermission('user.view')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { departments: true, roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  @Post()
  @RequirePermission('user.manage')
  async invite(@Body() dto: InviteUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.full_name,
        primaryDepartmentId: dto.primary_department_id,
        workCountry: dto.work_country,
        workState: dto.work_state,
        managerId: dto.manager_id,
        authProvider: 'google',
      },
    });
    let roleIds = dto.role_ids?.filter(Boolean) ?? [];
    if (roleIds.length === 0) {
      const employeeRole = await this.prisma.role.findFirst({ where: { name: 'Employee' } });
      if (employeeRole) roleIds = [employeeRole.id];
    }
    if (roleIds.length) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
          departmentOverride: dto.primary_department_id,
        })),
        skipDuplicates: true,
      });
    }
    return this.get(user.id);
  }

  @Patch(':id')
  @RequirePermission('user.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.full_name,
        primaryDepartmentId: dto.primary_department_id,
        workCountry: dto.work_country,
        workState: dto.work_state,
        managerId: dto.manager_id,
        isActive: dto.is_active,
      },
    });

    // Notify the user when their manager changes (role reflection / visibility gap).
    if (dto.manager_id !== undefined && dto.manager_id !== existing.managerId) {
      const newManager = dto.manager_id
        ? await this.prisma.user.findUnique({ where: { id: dto.manager_id }, select: { fullName: true } })
        : null;
      await this.notifications
        .notify(id, 'manager_assigned', { managerName: newManager?.fullName ?? 'a team lead' })
        .catch(() => {});
    }

    if (dto.department_ids) {
      await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
      await this.prisma.userDepartment.createMany({
        data: dto.department_ids.map((departmentId) => ({ userId: id, departmentId })),
        skipDuplicates: true,
      });
    }

    if (dto.role_ids !== undefined) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      let roleIds = dto.role_ids.filter(Boolean);
      if (roleIds.length === 0) {
        const employeeRole = await this.prisma.role.findFirst({ where: { name: 'Employee' } });
        if (employeeRole) roleIds = [employeeRole.id];
      }
      for (const roleId of roleIds) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        const departmentOverride =
          role?.name === 'Admin'
            ? null
            : (dto.primary_department_id ?? existing.primaryDepartmentId);
        await this.prisma.userRole.create({
          data: {
            userId: id,
            roleId,
            departmentOverride,
          },
        });
      }
    }
    return this.get(id);
  }

  /**
   * Hard-delete all non-admin users and their tasks. Admin-only, irreversible.
   * Used to reset the DB to a clean state for fresh testing.
   */
  @Delete('cleanup/all-non-admin')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.manage')
  async cleanupNonAdminUsers(@CurrentUser() callerUser: { id: string }) {
    // Find all users except the caller (who must be an Admin to reach this)
    const usersToDelete = await this.prisma.user.findMany({
      where: { id: { not: callerUser.id } },
      select: { id: true },
    });
    const ids = usersToDelete.map((u) => u.id);

    if (ids.length === 0) return { deleted: 0, message: 'Nothing to delete — only the admin remains.' };

    // Find tasks linked to these users
    const linkedTasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { createdById: { in: ids } },
          { assigneeId: { in: ids } },
          { estimateSubmittedById: { in: ids } },
        ],
      },
      select: { id: true },
    });
    const taskIds = linkedTasks.map((t) => t.id);

    if (taskIds.length > 0) {
      await this.prisma.timeLog.deleteMany({ where: { taskId: { in: taskIds } } });
      await this.prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
      await this.prisma.taskAttachment.deleteMany({ where: { taskId: { in: taskIds } } });
      await this.prisma.taskDependency.deleteMany({
        where: { OR: [{ taskId: { in: taskIds } }, { dependsOnTaskId: { in: taskIds } }] },
      });
      await this.prisma.approvalStep.deleteMany({ where: { taskId: { in: taskIds } } });
      await this.prisma.activityLogEntry.deleteMany({ where: { taskId: { in: taskIds } } });
      await this.prisma.taskCustomFieldValue.deleteMany({ where: { taskId: { in: taskIds } } });
      // Subtasks first, then parents
      await this.prisma.task.deleteMany({ where: { id: { in: taskIds }, parentTaskId: { not: null } } });
      await this.prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    // Clean up per-user data (cascade handles most, but explicit deletes for safety)
    await this.prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await this.prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
    await this.prisma.activityLogEntry.deleteMany({ where: { actorId: { in: ids } } });
    await this.prisma.timeLog.deleteMany({ where: { userId: { in: ids } } });
    await this.prisma.taskComment.deleteMany({ where: { authorId: { in: ids } } });
    await this.prisma.approvalStep.deleteMany({ where: { approverId: { in: ids } } });
    await this.prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await this.prisma.userDepartment.deleteMany({ where: { userId: { in: ids } } });
    // Saved reports
    const reportsToDelete = await this.prisma.savedReport.findMany({
      where: { createdById: { in: ids } },
      select: { id: true },
    });
    if (reportsToDelete.length > 0) {
      await this.prisma.reportSchedule.deleteMany({
        where: { savedReportId: { in: reportsToDelete.map(r => r.id) } },
      });
      await this.prisma.savedReport.deleteMany({ where: { createdById: { in: ids } } });
    }

    await this.prisma.user.deleteMany({ where: { id: { in: ids } } });

    return { deleted: ids.length, message: `Deleted ${ids.length} users and all associated data.` };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.manage')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() callerUser: { id: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (callerUser?.id === id) {
      throw new BadRequestException('You cannot delete your own user account.');
    }

    // 1. Reassign tasks created by this user to the caller (admin) so they are not orphaned
    if (callerUser?.id) {
      await this.prisma.task.updateMany({
        where: { createdById: id },
        data: { createdById: callerUser.id },
      });
    }

    // 2. Unassign tasks assigned to this user
    await this.prisma.task.updateMany({
      where: { assigneeId: id },
      data: { assigneeId: null },
    });

    // 3. Clear estimateSubmittedById on tasks
    await this.prisma.task.updateMany({
      where: { estimateSubmittedById: id },
      data: { estimateSubmittedById: null },
    });

    // 4. Managers & direct reports: clear managerId for any direct reports
    await this.prisma.user.updateMany({
      where: { managerId: id },
      data: { managerId: null },
    });

    // 5. Department head: clear headUserId if this user is a head of department
    await this.prisma.department.updateMany({
      where: { headUserId: id },
      data: { headUserId: null },
    });

    // 6. Integrations: clear updatedById
    await this.prisma.integrationSetting.updateMany({
      where: { updatedById: id },
      data: { updatedById: null },
    });

    // 7. Bug reports: delete reports submitted by this user
    await this.prisma.bugReport.deleteMany({
      where: { reporterId: id },
    });

    // 8. Action requests: clear reviewerId, delete requesterId
    await this.prisma.taskActionRequest.updateMany({
      where: { reviewerId: id },
      data: { reviewerId: null },
    });
    await this.prisma.taskActionRequest.deleteMany({
      where: { requesterId: id },
    });

    // 9. Task reviews
    await this.prisma.taskReview.deleteMany({
      where: { reviewerId: id },
    });

    // 10. Comments, time logs, attachments, activity log entries
    await this.prisma.taskComment.deleteMany({ where: { authorId: id } });
    await this.prisma.timeLog.deleteMany({ where: { userId: id } });
    await this.prisma.taskAttachment.deleteMany({ where: { uploadedById: id } });
    await this.prisma.activityLogEntry.deleteMany({ where: { actorId: id } });

    // 11. Notifications and preferences
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.notificationPreference.deleteMany({ where: { userId: id } });

    // 12. Approval steps
    await this.prisma.approvalStep.deleteMany({ where: { approverId: id } });

    // 13. User departments & roles
    await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.deleteMany({ where: { userId: id } });

    // 14. Saved reports & schedules
    const reports = await this.prisma.savedReport.findMany({
      where: { createdById: id },
      select: { id: true },
    });
    if (reports.length > 0) {
      await this.prisma.reportSchedule.deleteMany({
        where: { savedReportId: { in: reports.map((r) => r.id) } },
      });
      await this.prisma.savedReport.deleteMany({ where: { createdById: id } });
    }

    // 15. Finally delete the user record
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `User ${existing.fullName} deleted successfully.` };
  }

  private toDto(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    primaryDepartmentId: string;
    workCountry: string;
    workState: string;
    managerId: string | null;
    authProvider: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    departments: { departmentId: string }[];
    roles: { role: { id: string; name: string } }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      primary_department_id: user.primaryDepartmentId,
      work_country: user.workCountry,
      work_state: user.workState,
      manager_id: user.managerId,
      department_ids: user.departments.map((d) => d.departmentId),
      auth_provider: user.authProvider,
      is_active: user.isActive,
      last_login_at: user.lastLoginAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      roles: user.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
    };
  }
}
