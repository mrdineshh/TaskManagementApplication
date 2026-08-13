import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { EscalationRule } from '@taskapp/shared-types';

/**
 * Periodic SLA breach/escalation check (docs/05-FEATURES.md §2.2). In production this runs
 * via Cloud Scheduler + Cloud Tasks calling an internal endpoint (docs/01-ARCHITECTURE.md §2.3);
 * this in-process interval is the local stand-in so the feature is exercisable end-to-end
 * without GCP access. Swap for a Cloud Scheduler-triggered endpoint at deploy time — the
 * check logic itself (`runCheck`) doesn't need to change.
 */
@Injectable()
export class SLAEscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SLAEscalationService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get<string>('SLA_CHECK_INTERVAL_MS') ?? 60_000);
    this.timer = setInterval(() => {
      this.runCheck().catch((err) => this.logger.error(`SLA check failed: ${err.message}`, err.stack));
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCheck() {
    const openTasks = await this.prisma.task.findMany({
      where: { deletedAt: null, slaPolicyId: { not: null }, status: { category: { in: ['todo', 'in_progress'] } } },
      include: { slaPolicy: true, status: true },
    });

    for (const task of openTasks) {
      if (!task.slaPolicy?.isActive) continue;
      const rules = (task.slaPolicy.escalationRules as unknown as EscalationRule[]) ?? [];
      if (!rules.length) continue;

      const elapsedMinutes = (Date.now() - task.createdAt.getTime()) / 60_000;
      const percentElapsed = (elapsedMinutes / task.slaPolicy.resolutionTimeMinutes) * 100;

      for (const rule of rules) {
        if (percentElapsed < rule.percent_elapsed) continue;

        const alreadyNotified = await this.prisma.activityLogEntry.findFirst({
          where: { taskId: task.id, action: 'sla_escalation', metadata: { path: ['percent_elapsed'], equals: rule.percent_elapsed } },
        });
        if (alreadyNotified) continue;

        await this.escalate(task.id, task.title, task.assigneeId, rule);
      }
    }
  }

  private async escalate(
    taskId: string,
    taskTitle: string,
    assigneeId: string | null,
    rule: EscalationRule,
  ) {
    const targets = await this.resolveNotifyTargets(rule.notify, assigneeId);
    for (const userId of targets) {
      await this.notifications.notify(userId, 'sla_breach', { taskId, taskTitle, percentElapsed: rule.percent_elapsed });
    }
    await this.prisma.activityLogEntry.create({
      data: {
        taskId,
        actorId: null, // system-triggered, not a human action
        action: 'sla_escalation',
        metadata: { percent_elapsed: rule.percent_elapsed, notify: rule.notify, notified: targets },
      },
    });
  }

  /**
   * "assignee_manager" originally had no real reports-to field to resolve against and fell
   * back to anyone holding task.assign in the department. Phase 1 (docs/10-OPEN-DECISIONS.md
   * §G1) added User.managerId — the actual field this was standing in for — so this now
   * resolves to the assignee's real Manager instead of that department-wide approximation.
   */
  private async resolveNotifyTargets(notify: EscalationRule['notify'], assigneeId: string | null): Promise<string[]> {
    if (notify === 'assignee') {
      return assigneeId ? [assigneeId] : [];
    }

    if (!assigneeId) return [];
    const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    return assignee?.managerId ? [assignee.managerId] : [];
  }
}
