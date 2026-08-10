import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { assertDepartmentScope } from '../common/scope.util';

/** Basic v1 dashboards (docs/05-FEATURES.md §1.6) — precursors to the full v1.2 reporting engine. */
@ApiTags('dashboards')
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('personal')
  @RequirePermission('task.view')
  async personal(@CurrentUser() user: AccessTokenPayload) {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const base = { assigneeId: user.sub, deletedAt: null as null };

    const [openTasks, overdueCount, dueThisWeek, recentlyCompleted] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...base, status: { category: { in: ['todo', 'in_progress'] } } },
        include: { status: true, priority: true },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.task.count({
        where: { ...base, dueDate: { lt: now }, status: { category: { in: ['todo', 'in_progress'] } } },
      }),
      this.prisma.task.count({
        where: { ...base, dueDate: { gte: now, lte: weekEnd }, status: { category: { in: ['todo', 'in_progress'] } } },
      }),
      this.prisma.task.findMany({
        where: { ...base, status: { category: 'done' } },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
    ]);

    return { open_tasks: openTasks, overdue_count: overdueCount, due_this_week_count: dueThisWeek, recently_completed: recentlyCompleted };
  }

  @Get('department')
  @RequirePermission('task.view')
  async department(@CurrentUser() user: AccessTokenPayload, @Query('department_id') departmentId: string) {
    assertDepartmentScope(user, departmentId);
    const now = new Date();
    const base = { departmentId, deletedAt: null as null };

    const [byStatus, overdue, byAssignee, recentlyCreated] = await Promise.all([
      this.prisma.task.groupBy({ by: ['statusId'], where: base, _count: true }),
      this.prisma.task.count({
        where: { ...base, dueDate: { lt: now }, status: { category: { in: ['todo', 'in_progress'] } } },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...base, status: { category: { in: ['todo', 'in_progress'] } } },
        _count: true,
      }),
      this.prisma.task.findMany({ where: base, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      counts_by_status: byStatus.map((s) => ({ status_id: s.statusId, count: s._count })),
      overdue_count: overdue,
      workload_by_assignee: byAssignee.map((a) => ({ assignee_id: a.assigneeId, count: a._count })),
      recently_created: recentlyCreated,
    };
  }
}
