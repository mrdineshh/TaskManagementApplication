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

  /**
   * Migrated to read from ReportAggregateCache (docs/05-FEATURES.md §3.6) instead of live
   * Task queries: department-level counts tolerate the aggregate refresh interval's staleness
   * window (default 15min) since near-real-time isn't required here, and reusing the same
   * cache the reporting engine already maintains avoids running two aggregation strategies
   * side by side. `recently_created` is a real task list, not an aggregate metric, so it
   * still reads live — there's no cached equivalent to reconstruct it from.
   */
  @Get('department')
  @RequirePermission('task.view')
  async department(@CurrentUser() user: AccessTokenPayload, @Query('department_id') departmentId: string) {
    assertDepartmentScope(user, departmentId);
    const today = startOfDay(new Date());

    const [statusRows, overdueRow, assigneeRows, recentlyCreated] = await Promise.all([
      this.prisma.reportAggregateCache.findMany({
        where: { metricKey: 'task_counts_by_status', departmentId, periodDate: today },
      }),
      this.prisma.reportAggregateCache.findFirst({
        where: { metricKey: 'overdue_count', departmentId, periodDate: today },
      }),
      this.prisma.reportAggregateCache.findMany({
        where: { metricKey: 'workload_distribution', departmentId, periodDate: today },
      }),
      this.prisma.task.findMany({ where: { departmentId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      counts_by_status: statusRows.map((r) => ({ status_id: r.dimensionValue, count: r.value })),
      overdue_count: overdueRow?.value ?? 0,
      workload_by_assignee: assigneeRows.map((r) => ({ assignee_id: r.dimensionValue === 'unassigned' ? null : r.dimensionValue, count: r.value })),
      recently_created: recentlyCreated,
    };
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
