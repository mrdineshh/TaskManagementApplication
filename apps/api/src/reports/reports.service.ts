import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  reportConfigSchema,
  type ReportConfig,
  type ReportDateRange,
  type ReportExportFormat,
  type ReportMetricKey,
  type ReportRunResult,
} from '@taskapp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { assertDepartmentScope } from '../common/scope.util';
import type { AccessTokenPayload } from '../auth/auth.service';
import type { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { toCsv, toPdf, toXlsx } from './report-export.util';

/** Flow/cumulative metrics are summed across the date range; everything else is a point-in-time
 * snapshot, so we read the latest periodDate on or before the range end (docs/05-FEATURES.md §3.6
 * — the aggregate cache retains one row per day per dimension, so "latest in range" is that day's
 * end-of-day state once the day has passed). */
const FLOW_METRICS = new Set<ReportMetricKey>(['completion_throughput', 'time_tracked_minutes']);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseConfig(raw: Record<string, unknown>): ReportConfig {
    const parsed = reportConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid report config', details: parsed.error.flatten() });
    }
    return parsed.data;
  }

  private async userRoleIds(userId: string): Promise<string[]> {
    const roles = await this.prisma.userRole.findMany({ where: { userId }, select: { roleId: true } });
    return roles.map((r) => r.roleId);
  }

  async list(user: AccessTokenPayload) {
    const roleIds = await this.userRoleIds(user.sub);
    return this.prisma.savedReport.findMany({
      where: {
        OR: [
          { createdById: user.sub },
          { visibility: 'shared_org' },
          { visibility: 'shared_roles', sharedWithRoleIds: { hasSome: roleIds } },
        ],
      },
      orderBy: [{ isTemplate: 'desc' }, { name: 'asc' }],
    });
  }

  async getVisible(user: AccessTokenPayload, id: string) {
    const report = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.assertVisible(user, report);
    return report;
  }

  private async assertVisible(
    user: AccessTokenPayload,
    report: { createdById: string; visibility: string; sharedWithRoleIds: string[] },
  ) {
    if (report.createdById === user.sub || report.visibility === 'shared_org') return;
    if (report.visibility === 'shared_roles') {
      const roleIds = await this.userRoleIds(user.sub);
      if (report.sharedWithRoleIds.some((id) => roleIds.includes(id))) return;
    }
    throw new ForbiddenException('This report is not shared with you');
  }

  async create(user: AccessTokenPayload, dto: CreateReportDto) {
    this.parseConfig(dto.config); // validate shape before persisting
    return this.prisma.savedReport.create({
      data: {
        name: dto.name,
        createdById: user.sub,
        config: dto.config as Prisma.InputJsonValue,
        visibility: dto.visibility ?? 'private',
        sharedWithRoleIds: dto.shared_with_role_ids ?? [],
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, dto: UpdateReportDto) {
    const existing = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.createdById !== user.sub && !user.permissions.includes('report.manage')) {
      throw new ForbiddenException('Only the report owner or an admin can edit this report');
    }
    if (dto.config) this.parseConfig(dto.config);
    return this.prisma.savedReport.update({
      where: { id },
      data: {
        name: dto.name,
        config: dto.config as Prisma.InputJsonValue | undefined,
        visibility: dto.visibility,
        sharedWithRoleIds: dto.shared_with_role_ids,
      },
    });
  }

  async remove(user: AccessTokenPayload, id: string) {
    const existing = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.createdById !== user.sub && !user.permissions.includes('report.manage')) {
      throw new ForbiddenException('Only the report owner or an admin can delete this report');
    }
    await this.prisma.savedReport.delete({ where: { id } });
    return { success: true };
  }

  async preview(user: AccessTokenPayload, rawConfig: Record<string, unknown>): Promise<ReportRunResult[]> {
    const config = this.parseConfig(rawConfig);
    return this.runConfig(user, config);
  }

  async run(user: AccessTokenPayload, id: string): Promise<ReportRunResult[]> {
    const report = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.assertVisible(user, report);
    const config = this.parseConfig(report.config as Record<string, unknown>);
    return this.runConfig(user, config);
  }

  async exportSaved(user: AccessTokenPayload, id: string, format: ReportExportFormat) {
    const report = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.assertVisible(user, report);
    const config = this.parseConfig(report.config as Record<string, unknown>);
    const results = await this.runConfig(user, config);
    return this.render(report.name, results, format);
  }

  async exportPreview(user: AccessTokenPayload, rawConfig: Record<string, unknown>, format: ReportExportFormat) {
    const config = this.parseConfig(rawConfig);
    const results = await this.runConfig(user, config);
    return this.render('Report Preview', results, format);
  }

  private async render(
    reportName: string,
    results: ReportRunResult[],
    format: ReportExportFormat,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    switch (format) {
      case 'csv':
        return { buffer: Buffer.from(toCsv(results), 'utf-8'), contentType: 'text/csv', extension: 'csv' };
      case 'xlsx':
        return {
          buffer: await toXlsx(reportName, results),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      case 'pdf':
        return { buffer: await toPdf(reportName, results), contentType: 'application/pdf', extension: 'pdf' };
    }
  }

  /**
   * Resolves the department set a user's report run is allowed to see (docs/05-FEATURES.md §3.1):
   * a department-scoped role is pinned to its own department(s) regardless of the config's own
   * filter; an org-wide role can filter to one department or leave it unset for everything.
   * Returns null for "no restriction" (org-wide, no filter picked).
   */
  private resolveDepartmentScope(user: AccessTokenPayload, filterDeptId?: string): string[] | null {
    if (filterDeptId) {
      if (!user.hasOrgWideRole) assertDepartmentScope(user, filterDeptId);
      return [filterDeptId];
    }
    return user.hasOrgWideRole ? null : user.departmentIds;
  }

  private async runConfig(user: AccessTokenPayload, config: ReportConfig): Promise<ReportRunResult[]> {
    const departmentIds = this.resolveDepartmentScope(user, config.filters.department_id);
    const { start, end } = resolveDateRange(config.date_range);
    const labels = await this.loadLabelMaps();

    const results: ReportRunResult[] = [];
    for (const metricKey of config.metrics) {
      results.push(await this.runMetric(metricKey, departmentIds, start, end, labels));
    }
    return results;
  }

  private async runMetric(
    metricKey: ReportMetricKey,
    departmentIds: string[] | null,
    start: Date,
    end: Date,
    labels: LabelMaps,
  ): Promise<ReportRunResult> {
    const isOrgLevelMetric = metricKey === 'task_counts_by_department';
    const where: Prisma.ReportAggregateCacheWhereInput = {
      metricKey,
      periodDate: { gte: start, lte: end },
    };
    if (isOrgLevelMetric) {
      where.departmentId = null;
      if (departmentIds) where.dimensionValue = { in: departmentIds };
    } else if (departmentIds) {
      where.departmentId = { in: departmentIds };
    }

    const rows = await this.prisma.reportAggregateCache.findMany({ where, orderBy: { periodDate: 'asc' } });
    const byDimension = new Map<string, { value: number; periodDate: Date }>();

    for (const row of rows) {
      if (FLOW_METRICS.has(metricKey)) {
        const existing = byDimension.get(row.dimensionValue);
        byDimension.set(row.dimensionValue, { value: (existing?.value ?? 0) + row.value, periodDate: row.periodDate });
      } else {
        const existing = byDimension.get(row.dimensionValue);
        if (!existing || row.periodDate >= existing.periodDate) {
          byDimension.set(row.dimensionValue, { value: row.value, periodDate: row.periodDate });
        }
      }
    }

    const resultRows = [...byDimension.entries()].map(([dimensionValue, { value }]) => ({
      dimension_label: labelFor(metricKey, dimensionValue, labels),
      dimension_value: dimensionValue,
      value,
    }));
    return { metric: metricKey, rows: resultRows };
  }

  private async loadLabelMaps(): Promise<LabelMaps> {
    const [departments, statuses, priorities, users] = await Promise.all([
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.workflowStatus.findMany({ select: { id: true, label: true } }),
      this.prisma.priorityDefinition.findMany({ select: { id: true, label: true } }),
      this.prisma.user.findMany({ select: { id: true, fullName: true } }),
    ]);
    return {
      department: new Map(departments.map((d) => [d.id, d.name])),
      status: new Map(statuses.map((s) => [s.id, s.label])),
      priority: new Map(priorities.map((p) => [p.id, p.label])),
      user: new Map(users.map((u) => [u.id, u.fullName])),
    };
  }
}

interface LabelMaps {
  department: Map<string, string>;
  status: Map<string, string>;
  priority: Map<string, string>;
  user: Map<string, string>;
}

const USER_KEYED_METRICS = new Set<ReportMetricKey>(['task_counts_by_assignee', 'workload_distribution', 'time_tracked_minutes']);

function labelFor(metricKey: ReportMetricKey, dimensionValue: string, labels: LabelMaps): string {
  if (dimensionValue === 'all') return 'All';
  if (dimensionValue === 'unassigned') return 'Unassigned';
  if (metricKey === 'task_counts_by_status') return labels.status.get(dimensionValue) ?? dimensionValue;
  if (metricKey === 'task_counts_by_department') return labels.department.get(dimensionValue) ?? dimensionValue;
  if (metricKey === 'task_counts_by_priority') return labels.priority.get(dimensionValue) ?? dimensionValue;
  if (USER_KEYED_METRICS.has(metricKey)) return labels.user.get(dimensionValue) ?? dimensionValue;
  return dimensionValue;
}

function resolveDateRange(range: ReportDateRange): { start: Date; end: Date } {
  if ('start' in range) return { start: new Date(range.start), end: new Date(range.end) };

  const now = new Date();
  const end = now;
  switch (range.preset) {
    case 'last_7_days':
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end };
    case 'last_30_days':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end };
    case 'this_month':
      return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end };
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      return { start: new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1)), end };
    }
    case 'this_year':
      return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end };
  }
}
