import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { assertDepartmentScope } from '../common/scope.util';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { isOverdueOnBusinessDay } from '../common/business-days.util';
import { RbacService } from '../rbac/rbac.service';

interface TaskForStats {
  id: string;
  title: string;
  assigneeId: string | null;
  dueDate: Date | null;
  estimateValue: number | null;
  estimateUnit: string | null;
  status: { id: string; label: string; color: string | null; category: string };
  timeLogs: { minutes: number }[];
  assignee: { workCountry: string; workState: string } | null;
}

/** Basic v1 dashboards (docs/05-FEATURES.md §1.6) — precursors to the full v1.2 reporting engine. */
@ApiTags('dashboards')
@Controller('dashboards')
export class DashboardsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidayCalendars: HolidayCalendarsService,
    private readonly rbac: RbacService,
  ) {}

  @Get('personal')
  @RequirePermission('task.view')
  async personal(@CurrentUser() user: AccessTokenPayload) {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const base = { assigneeId: user.sub, deletedAt: null as null };

    const [me, openTasks, dueThisWeek, recentlyCompleted] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } }),
      this.prisma.task.findMany({
        where: { ...base, status: { category: { in: ['todo', 'in_progress'] } } },
        include: { status: true, priority: true, timeLogs: { select: { minutes: true } } },
        orderBy: { dueDate: 'asc' },
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

    // Overdue and over-budget (docs/10-OPEN-DECISIONS.md §I1) — independent metrics, never
    // merged. Overdue is business-day-aware per this user's own region; a task appearing in
    // both counts is possible and expected.
    const holidays = await this.holidayCalendars.getHolidayDateKeys(me.workCountry, me.workState);
    let overdueCount = 0;
    let overBudgetCount = 0;
    for (const task of openTasks) {
      if (task.dueDate && isOverdueOnBusinessDay(task.dueDate, now, holidays)) overdueCount++;
      if (task.estimateValue !== null && task.estimateUnit !== null) {
        const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
        const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
        if (loggedMinutes > estimateMinutes) overBudgetCount++;
      }
    }

    return {
      open_tasks: openTasks,
      overdue_count: overdueCount,
      over_budget_count: overBudgetCount,
      due_this_week_count: dueThisWeek,
      recently_completed: recentlyCompleted,
    };
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

    const [statusRows, overdueRow, overBudgetRow, assigneeRows, recentlyCreated] = await Promise.all([
      this.prisma.reportAggregateCache.findMany({
        where: { metricKey: 'task_counts_by_status', departmentId, periodDate: today },
      }),
      this.prisma.reportAggregateCache.findFirst({
        where: { metricKey: 'overdue_count', departmentId, periodDate: today },
      }),
      this.prisma.reportAggregateCache.findFirst({
        where: { metricKey: 'over_budget_count', departmentId, periodDate: today },
      }),
      this.prisma.reportAggregateCache.findMany({
        where: { metricKey: 'workload_distribution', departmentId, periodDate: today },
      }),
      this.prisma.task.findMany({ where: { departmentId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      counts_by_status: statusRows.map((r) => ({ status_id: r.dimensionValue, count: r.value })),
      overdue_count: overdueRow?.value ?? 0,
      over_budget_count: overBudgetRow?.value ?? 0,
      workload_by_assignee: assigneeRows.map((r) => ({ assignee_id: r.dimensionValue === 'unassigned' ? null : r.dimensionValue, count: r.value })),
      recently_created: recentlyCreated,
    };
  }

  /**
   * Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K) — the SAME endpoint returns a
   * different shape depending on the caller's *active role* (not their full permission set,
   * which stays the union of every role they hold): a Manager sees only their explicit direct
   * reports, a Head sees their whole department broken down by Manager, and
   * Management/Admin see an org-wide summary across every department (or one department's
   * detail when `department_id` is passed) — all computed live, per the confirmed scope
   * rules from Phase 1 scoping ("the manager is restricted to view only his team members
   * details... the head should see the entire managers and the whole team's view filtered by
   * managers").
   */
  @Get('team')
  @RequirePermission('task.view')
  async team(@CurrentUser() user: AccessTokenPayload, @Query('department_id') departmentId?: string) {
    const activeRole = await this.rbac.resolveActiveRoleName(user.sub);

    if (activeRole === 'Manager') {
      const reports = await this.prisma.user.findMany({
        where: { managerId: user.sub, isActive: true },
        select: { id: true, fullName: true },
      });
      const stats = await this.computeTaskStats(reports.map((r) => r.id));
      return { scope: 'manager', members: reports, ...stats };
    }

    if (activeRole === 'Head') {
      let department = await this.prisma.department.findFirst({ where: { headUserId: user.sub } });
      if (!department && user.departmentIds[0]) {
        department = await this.prisma.department.findUnique({ where: { id: user.departmentIds[0] } });
      }
      if (!department) return { scope: 'none' };
      return this.departmentBreakdown(department.id, department.name);
    }

    if (activeRole === 'Management' || activeRole === 'Admin') {
      if (departmentId) {
        const department = await this.prisma.department.findUniqueOrThrow({ where: { id: departmentId } });
        return this.departmentBreakdown(department.id, department.name);
      }
      const departments = await this.prisma.department.findMany({ where: { isActive: true } });
      const summaries = await Promise.all(
        departments.map(async (dept) => {
          const members = await this.prisma.user.findMany({ where: { primaryDepartmentId: dept.id, isActive: true }, select: { id: true } });
          const stats = await this.computeTaskStats(members.map((m) => m.id));
          return { department_id: dept.id, department_name: dept.name, member_count: members.length, ...stats };
        }),
      );
      return { scope: 'org', departments: summaries };
    }

    // Employee (or no resolvable role) — no team to show; the nav hides this page for them.
    return { scope: 'none' };
  }

  private async departmentBreakdown(departmentId: string, departmentName: string) {
    const members = await this.prisma.user.findMany({
      where: { primaryDepartmentId: departmentId, isActive: true },
      select: { id: true, fullName: true, managerId: true },
    });
    const memberIds = members.map((m) => m.id);
    const deptStats = await this.computeTaskStats(memberIds);

    // "Filtered by managers" (§G1) — group the department's members under whichever of them
    // is referenced as someone else's managerId; members with no direct reports of their own
    // are omitted from this breakdown (still counted in deptStats above).
    const managerIds = [...new Set(members.map((m) => m.managerId).filter((id): id is string => !!id))];
    const managers = members.filter((m) => managerIds.includes(m.id));
    const byManager = await Promise.all(
      managers.map(async (manager) => {
        const reports = members.filter((m) => m.managerId === manager.id);
        const stats = await this.computeTaskStats(reports.map((r) => r.id));
        return { manager_id: manager.id, manager_name: manager.fullName, member_count: reports.length, ...stats };
      }),
    );

    return {
      scope: 'department',
      department_id: departmentId,
      department_name: departmentName,
      members,
      by_manager: byManager,
      ...deptStats,
    };
  }

  /** Shared open-task stats (status breakdown, business-day overdue, over-budget) for an arbitrary set of assignees. */
  private async computeTaskStats(assigneeIds: string[]) {
    if (assigneeIds.length === 0) {
      return { counts_by_status: [], overdue_count: 0, over_budget_count: 0, open_count: 0 };
    }

    const tasks = (await this.prisma.task.findMany({
      where: { assigneeId: { in: assigneeIds }, deletedAt: null, status: { category: { in: ['todo', 'in_progress'] } } },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        dueDate: true,
        estimateValue: true,
        estimateUnit: true,
        status: { select: { id: true, label: true, color: true, category: true } },
        timeLogs: { select: { minutes: true } },
        assignee: { select: { workCountry: true, workState: true } },
      },
    })) as unknown as TaskForStats[];

    const now = new Date();
    const holidayCache = new Map<string, ReadonlySet<string>>();
    const statusCounts = new Map<string, { label: string; color: string | null; count: number }>();
    let overdueCount = 0;
    let overBudgetCount = 0;

    for (const task of tasks) {
      const existing = statusCounts.get(task.status.id) ?? { label: task.status.label, color: task.status.color, count: 0 };
      existing.count++;
      statusCounts.set(task.status.id, existing);

      if (task.estimateValue !== null && task.estimateUnit !== null) {
        const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
        const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
        if (loggedMinutes > estimateMinutes) overBudgetCount++;
      }

      if (task.dueDate && task.assignee) {
        const regionKey = `${task.assignee.workCountry}::${task.assignee.workState}`;
        if (!holidayCache.has(regionKey)) {
          holidayCache.set(regionKey, await this.holidayCalendars.getHolidayDateKeys(task.assignee.workCountry, task.assignee.workState));
        }
        if (isOverdueOnBusinessDay(task.dueDate, now, holidayCache.get(regionKey)!)) overdueCount++;
      }
    }

    return {
      counts_by_status: [...statusCounts.entries()].map(([statusId, v]) => ({ status_id: statusId, ...v })),
      overdue_count: overdueCount,
      over_budget_count: overBudgetCount,
      open_count: tasks.length,
    };
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
