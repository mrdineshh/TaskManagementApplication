import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { isOverdueOnBusinessDay } from '../common/business-days.util';
import type { ReportMetricKey } from '@taskapp/shared-types';

interface AggregateRow {
  metricKey: ReportMetricKey;
  departmentId: string | null;
  dimensionValue: string;
  value: number;
}

/**
 * Periodic aggregate refresh (docs/05-FEATURES.md §3.6) — in production this runs via Cloud
 * Scheduler + Cloud Tasks calling an internal endpoint, same pattern as SLAEscalationService;
 * this in-process interval is the local stand-in. Report reads (ReportsService) hit
 * ReportAggregateCache, never the raw Task/TimeLog tables directly, keeping report load cheap
 * regardless of task volume.
 *
 * Snapshot metrics (counts, rates, distributions) are recomputed for "today"'s bucket every
 * cycle, representing current state. `completion_throughput` is the one true time-series
 * metric — its historical daily buckets are immutable once the day has passed (a task
 * completed on a past day doesn't change), so only today's bucket needs continual refreshing.
 */
@Injectable()
export class ReportAggregationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportAggregationService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly holidayCalendars: HolidayCalendarsService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get<string>('REPORT_AGGREGATE_REFRESH_MS') ?? 15 * 60_000);
    this.timer = setInterval(() => {
      this.refresh().catch((err) => this.logger.error(`Aggregate refresh failed: ${err.message}`, err.stack));
    }, intervalMs);
    // Also run once at startup so reports have data immediately in dev, rather than waiting
    // a full interval after every restart.
    this.refresh().catch((err) => this.logger.error(`Initial aggregate refresh failed: ${err.message}`, err.stack));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh() {
    const departments = await this.prisma.department.findMany({ where: { isActive: true } });
    const today = startOfDay(new Date());
    const rows: AggregateRow[] = [];

    for (const dept of departments) {
      rows.push(...(await this.taskCountsByStatus(dept.id)));
      rows.push(...(await this.taskCountsByAssignee(dept.id)));
      rows.push(...(await this.taskCountsByPriority(dept.id)));
      rows.push(...(await this.overdueAndOverBudget(dept.id)));
      rows.push(await this.avgTimeToCompletion(dept.id));
      rows.push(await this.slaComplianceRate(dept.id));
      rows.push(...(await this.workloadDistribution(dept.id)));
      rows.push(...(await this.timeTrackedMinutes(dept.id)));
      rows.push(await this.completionThroughput(dept.id, today));
    }
    rows.push(...(await this.taskCountsByDepartment()));

    for (const row of rows) {
      // Prisma's compound-unique `where` can't take null for a nullable member (same
      // limitation hit seeding org-wide PriorityDefinition rows) — org-wide rows
      // (departmentId null, e.g. task_counts_by_department) go through find+create/update.
      if (row.departmentId === null) {
        const existing = await this.prisma.reportAggregateCache.findFirst({
          where: { metricKey: row.metricKey, departmentId: null, dimensionValue: row.dimensionValue, periodDate: today },
        });
        if (existing) {
          await this.prisma.reportAggregateCache.update({
            where: { id: existing.id },
            data: { value: row.value, refreshedAt: new Date() },
          });
        } else {
          await this.prisma.reportAggregateCache.create({ data: { ...row, periodDate: today } });
        }
        continue;
      }

      await this.prisma.reportAggregateCache.upsert({
        where: {
          metricKey_departmentId_dimensionValue_periodDate: {
            metricKey: row.metricKey,
            departmentId: row.departmentId,
            dimensionValue: row.dimensionValue,
            periodDate: today,
          },
        },
        update: { value: row.value, refreshedAt: new Date() },
        create: { ...row, periodDate: today },
      });
    }
    this.logger.log(`Refreshed ${rows.length} report aggregate rows`);
  }

  private async taskCountsByStatus(departmentId: string): Promise<AggregateRow[]> {
    const grouped = await this.prisma.task.groupBy({
      by: ['statusId'],
      where: { departmentId, deletedAt: null },
      _count: true,
    });
    return grouped.map((g) => ({ metricKey: 'task_counts_by_status', departmentId, dimensionValue: g.statusId, value: g._count }));
  }

  private async taskCountsByDepartment(): Promise<AggregateRow[]> {
    const grouped = await this.prisma.task.groupBy({ by: ['departmentId'], where: { deletedAt: null }, _count: true });
    return grouped.map((g) => ({ metricKey: 'task_counts_by_department', departmentId: null, dimensionValue: g.departmentId, value: g._count }));
  }

  private async taskCountsByAssignee(departmentId: string): Promise<AggregateRow[]> {
    const grouped = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: { departmentId, deletedAt: null },
      _count: true,
    });
    return grouped.map((g) => ({
      metricKey: 'task_counts_by_assignee',
      departmentId,
      dimensionValue: g.assigneeId ?? 'unassigned',
      value: g._count,
    }));
  }

  private async taskCountsByPriority(departmentId: string): Promise<AggregateRow[]> {
    const grouped = await this.prisma.task.groupBy({
      by: ['priorityId'],
      where: { departmentId, deletedAt: null },
      _count: true,
    });
    return grouped.map((g) => ({ metricKey: 'task_counts_by_priority', departmentId, dimensionValue: g.priorityId, value: g._count }));
  }

  /**
   * Overdue and over-budget (docs/10-OPEN-DECISIONS.md §I1) are computed together since both
   * need the same open-task fetch, but tracked as two fully independent metrics — a task can
   * be either, both, or neither, never merged into one "at risk" flag (confirmed with the
   * user). Overdue is business-day-aware per the *assignee's* region (not the viewer's) via
   * HolidayCalendarsService; over-budget compares summed TimeLog minutes against the
   * assignee-submitted estimate, converting days to hours at 1 day = 8 hours.
   */
  private async overdueAndOverBudget(departmentId: string): Promise<AggregateRow[]> {
    const openTasks = await this.prisma.task.findMany({
      where: { departmentId, deletedAt: null, status: { category: { in: ['todo', 'in_progress'] } } },
      select: {
        id: true,
        dueDate: true,
        estimateValue: true,
        estimateUnit: true,
        assignee: { select: { workCountry: true, workState: true } },
        timeLogs: { select: { minutes: true } },
      },
    });

    const now = new Date();
    let overdueCount = 0;
    let overBudgetCount = 0;
    let estimatedCount = 0;

    for (const task of openTasks) {
      if (task.dueDate && task.assignee) {
        const holidays = await this.holidayCalendars.getHolidayDateKeys(task.assignee.workCountry, task.assignee.workState);
        if (isOverdueOnBusinessDay(task.dueDate, now, holidays)) overdueCount++;
      }

      if (task.estimateValue !== null && task.estimateUnit !== null) {
        estimatedCount++;
        const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
        const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
        if (loggedMinutes > estimateMinutes) overBudgetCount++;
      }
    }

    const openCount = openTasks.length;
    return [
      { metricKey: 'overdue_count', departmentId, dimensionValue: 'all', value: overdueCount },
      { metricKey: 'overdue_rate', departmentId, dimensionValue: 'all', value: openCount > 0 ? (overdueCount / openCount) * 100 : 0 },
      { metricKey: 'over_budget_count', departmentId, dimensionValue: 'all', value: overBudgetCount },
      { metricKey: 'over_budget_rate', departmentId, dimensionValue: 'all', value: estimatedCount > 0 ? (overBudgetCount / estimatedCount) * 100 : 0 },
    ];
  }

  private async avgTimeToCompletion(departmentId: string): Promise<AggregateRow> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completed = await this.prisma.task.findMany({
      where: { departmentId, deletedAt: null, completedAt: { gte: since, not: null } },
      select: { createdAt: true, completedAt: true },
    });
    if (completed.length === 0) return { metricKey: 'avg_time_to_completion_hours', departmentId, dimensionValue: 'all', value: 0 };
    const totalHours = completed.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000, 0);
    return { metricKey: 'avg_time_to_completion_hours', departmentId, dimensionValue: 'all', value: totalHours / completed.length };
  }

  private async slaComplianceRate(departmentId: string): Promise<AggregateRow> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completed = await this.prisma.task.findMany({
      where: { departmentId, deletedAt: null, completedAt: { gte: since, not: null }, slaPolicyId: { not: null } },
      select: { createdAt: true, completedAt: true, slaPolicy: { select: { resolutionTimeMinutes: true } } },
    });
    if (completed.length === 0) return { metricKey: 'sla_compliance_rate', departmentId, dimensionValue: 'all', value: 0 };
    const withinSla = completed.filter(
      (t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 60_000 <= (t.slaPolicy?.resolutionTimeMinutes ?? Infinity),
    ).length;
    return { metricKey: 'sla_compliance_rate', departmentId, dimensionValue: 'all', value: (withinSla / completed.length) * 100 };
  }

  private async workloadDistribution(departmentId: string): Promise<AggregateRow[]> {
    const grouped = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: { departmentId, deletedAt: null, status: { category: { in: ['todo', 'in_progress'] } } },
      _count: true,
    });
    return grouped
      .filter((g) => g.assigneeId !== null)
      .map((g) => ({ metricKey: 'workload_distribution', departmentId, dimensionValue: g.assigneeId!, value: g._count }));
  }

  private async timeTrackedMinutes(departmentId: string): Promise<AggregateRow[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.timeLog.findMany({
      where: { loggedAt: { gte: since }, task: { departmentId, deletedAt: null } },
      select: { userId: true, minutes: true },
    });
    const byUser = new Map<string, number>();
    for (const log of logs) byUser.set(log.userId, (byUser.get(log.userId) ?? 0) + log.minutes);
    return [...byUser.entries()].map(([userId, minutes]) => ({
      metricKey: 'time_tracked_minutes',
      departmentId,
      dimensionValue: userId,
      value: minutes,
    }));
  }

  private async completionThroughput(departmentId: string, today: Date): Promise<AggregateRow> {
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const value = await this.prisma.task.count({
      where: { departmentId, deletedAt: null, completedAt: { gte: today, lt: tomorrow } },
    });
    return { metricKey: 'completion_throughput', departmentId, dimensionValue: 'all', value };
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
