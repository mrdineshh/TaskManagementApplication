import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { isOverdueOnBusinessDay } from '../common/business-days.util';

/**
 * Overdue escalation (docs/10-OPEN-DECISIONS.md §I1) — distinct from SLAEscalationService,
 * which only fires for tasks with an SLAPolicy attached and is based on percent-of-resolution-
 * time elapsed. This checks every open task with a due date, business-day-aware, and notifies
 * the assignee's Manager (User.managerId) the first time it goes overdue — not on every check
 * cycle, deduped via an activity log entry the same way SLA escalation dedupes per rule.
 */
@Injectable()
export class OverdueEscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OverdueEscalationService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly holidayCalendars: HolidayCalendarsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get<string>('OVERDUE_CHECK_INTERVAL_MS') ?? 60_000);
    this.timer = setInterval(() => {
      this.runCheck().catch((err) => this.logger.error(`Overdue check failed: ${err.message}`, err.stack));
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCheck() {
    const openTasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { not: null },
        assigneeId: { not: null },
        status: { category: { in: ['todo', 'in_progress'] } },
      },
      include: { assignee: true },
    });

    const now = new Date();
    for (const task of openTasks) {
      if (!task.assignee || !task.dueDate) continue;

      const holidays = await this.holidayCalendars.getHolidayDateKeys(task.assignee.workCountry, task.assignee.workState);
      if (!isOverdueOnBusinessDay(task.dueDate, now, holidays)) continue;

      const alreadyEscalated = await this.prisma.activityLogEntry.findFirst({
        where: { taskId: task.id, action: 'overdue_escalated' },
      });
      if (alreadyEscalated) continue;

      if (task.assignee.managerId) {
        await this.notifications.notify(task.assignee.managerId, 'task_overdue', {
          taskId: task.id,
          taskTitle: task.title,
          assigneeId: task.assignee.id,
        });
      }
      // Logged even with no manager to notify (e.g. Head/Management have none) — the dedupe
      // check above relies on this entry existing regardless of whether notify() fired.
      await this.prisma.activityLogEntry.create({
        data: {
          taskId: task.id,
          actorId: null,
          action: 'overdue_escalated',
          metadata: { notifiedManagerId: task.assignee.managerId },
        },
      });
    }
  }
}
