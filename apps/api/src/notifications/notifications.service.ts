import { Injectable } from '@nestjs/common';
import type { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail/mail.service';
import { PushService } from './push/push.service';

const NOTIFICATION_SUBJECTS: Record<string, (payload: Record<string, unknown>) => string> = {
  task_assigned: (p) => `Task assigned to you: ${p.taskTitle}`,
  task_reassigned: (p) => `Task reassigned: ${p.taskTitle}`,
  due_soon: (p) => `Task due soon: ${p.taskTitle}`,
  task_overdue: (p) => `Task overdue: ${p.taskTitle}`,
  comment_mention: (p) => `You were mentioned on: ${p.taskTitle}`,
  status_changed: (p) => `Status changed: ${p.taskTitle}`,
};

/** In-app + email notifications per docs/05-FEATURES.md §1.5, 02-DATA-MODEL.md §7. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  async notify(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
    channels: NotificationChannel[] = ['in_app', 'email'],
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Push fires for the same event set as in-app/email once a device is registered
    // (docs/05-FEATURES.md §2.6) — callers don't need to opt in per-call, they just get it
    // automatically if (and only if) the user has ever registered a push token.
    const withPush = user?.pushToken && !channels.includes('push') ? [...channels, 'push' as const] : channels;

    // Per-event, per-channel opt-out (docs/05-FEATURES.md §1.5): a stored, explicit disable
    // is the only thing that removes a channel here — absence of a row means enabled, so this
    // never has to special-case new notification types or channels that predate a user's
    // preference rows.
    const disabled = await this.prisma.notificationPreference.findMany({
      where: { userId, type, channel: { in: withPush }, enabled: false },
      select: { channel: true },
    });
    const disabledChannels = new Set(disabled.map((d) => d.channel));
    const effectiveChannels = withPush.filter((c) => !disabledChannels.has(c));

    for (const channel of effectiveChannels) {
      const notification = await this.prisma.notification.create({
        data: { userId, type, payload: payload as Prisma.InputJsonValue, channel },
      });

      if (channel === 'email' && user) {
        const subjectFn = NOTIFICATION_SUBJECTS[type];
        const subject = subjectFn ? subjectFn(payload) : `Task Management notification: ${type}`;
        await this.mail.send(user.email, subject, JSON.stringify(payload, null, 2));
        await this.prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
      }

      if (channel === 'push' && user?.pushToken) {
        const subjectFn = NOTIFICATION_SUBJECTS[type];
        const title = subjectFn ? subjectFn(payload) : 'Task Management';
        await this.push.send(user.pushToken, title, type);
        await this.prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
      }
    }
  }

  // Notification bell (docs/10-OPEN-DECISIONS.md §M9) — a fixed 30-day window rather than
  // pagination, since the bell is meant to show "what's recent," not be a full archive browser.
  list(userId: string, unreadOnly: boolean) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.notification.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo }, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { success: true };
  }
}
