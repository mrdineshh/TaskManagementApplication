import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReportSchedule } from '@prisma/client';
import { reportConfigSchema } from '@taskapp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { MailService } from '../notifications/mail/mail.service';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ReportsService } from './reports.service';

/**
 * Scheduled report email delivery (docs/05-FEATURES.md §3.4) — in production this runs via
 * Cloud Scheduler + Cloud Tasks, same as SLA escalation and aggregate refresh; this in-process
 * interval is the local stand-in. Checks every REPORT_SCHEDULE_CHECK_MS (default 5 minutes)
 * for schedules whose send_at has passed today and haven't already run today.
 */
@Injectable()
export class ReportScheduleDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportScheduleDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly mail: MailService,
    private readonly reports: ReportsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get<string>('REPORT_SCHEDULE_CHECK_MS') ?? 5 * 60_000);
    this.timer = setInterval(() => {
      this.checkAndDeliver().catch((err) => this.logger.error(`Schedule check failed: ${err.message}`, err.stack));
    }, intervalMs);
    this.checkAndDeliver().catch((err) => this.logger.error(`Initial schedule check failed: ${err.message}`, err.stack));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async checkAndDeliver() {
    const now = new Date();
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { isActive: true },
      include: { savedReport: true },
    });

    let delivered = 0;
    for (const schedule of schedules) {
      if (!this.isDue(schedule, now)) continue;
      try {
        await this.deliver(schedule);
        delivered++;
      } catch (err) {
        this.logger.error(`Delivery failed for schedule ${schedule.id}: ${(err as Error).message}`, (err as Error).stack);
      }
    }
    if (delivered > 0) this.logger.log(`Delivered ${delivered} scheduled report(s)`);
  }

  private isDue(schedule: ReportSchedule, now: Date): boolean {
    const [hh, mm] = schedule.sendAt.split(':').map(Number);
    const scheduledToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
    if (now < scheduledToday) return false;
    if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && now.getUTCDay() !== schedule.dayOfWeek) return false;
    if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== null && now.getUTCDate() !== schedule.dayOfMonth) {
      return false;
    }
    // Daily/weekly/monthly all reduce to "at most once per matching UTC day" — the day-of-week/
    // day-of-month checks above already gate which days count as a match for those frequencies.
    if (schedule.lastRunAt && isSameUTCDate(schedule.lastRunAt, now)) return false;
    return true;
  }

  private async deliver(schedule: ReportSchedule & { savedReport: { id: string; name: string; createdById: string; config: unknown } }) {
    const config = reportConfigSchema.parse(schedule.savedReport.config);
    const asUser = await this.buildPayloadForUser(schedule.savedReport.createdById);
    const { buffer, contentType, extension } = await this.reports.renderForUser(
      asUser,
      schedule.savedReport.name,
      config,
      schedule.exportFormat,
    );

    const recipients = await this.resolveRecipientEmails(schedule);
    for (const email of recipients) {
      await this.mail.send(
        email,
        `Scheduled report: ${schedule.savedReport.name}`,
        `Your scheduled report "${schedule.savedReport.name}" is attached.`,
        [{ filename: `report.${extension}`, content: buffer, contentType }],
      );
    }

    await this.prisma.reportSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date() } });
  }

  private async resolveRecipientEmails(schedule: ReportSchedule): Promise<string[]> {
    const userIds = new Set(schedule.recipientUserIds);
    if (schedule.recipientRoleIds.length > 0) {
      const roleMembers = await this.prisma.userRole.findMany({
        where: { roleId: { in: schedule.recipientRoleIds } },
        select: { userId: true },
      });
      roleMembers.forEach((m) => userIds.add(m.userId));
    }
    if (userIds.size === 0) return [];
    const users = await this.prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { email: true } });
    return users.map((u) => u.email);
  }

  /** Runs with the report creator's effective RBAC scope, since a scheduled delivery has no live user session. */
  private async buildPayloadForUser(userId: string): Promise<AccessTokenPayload> {
    const [user, effective] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.rbac.getEffectivePermissions(userId),
    ]);
    return {
      sub: user.id,
      email: user.email,
      permissions: effective.permissionKeys,
      departmentIds: effective.departmentIds,
      hasOrgWideRole: effective.hasOrgWideRole,
    };
  }
}

function isSameUTCDate(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}
