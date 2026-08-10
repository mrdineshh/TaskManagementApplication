import { Injectable } from '@nestjs/common';
import type { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail/mail.service';

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
  ) {}

  async notify(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
    channels: NotificationChannel[] = ['in_app', 'email'],
  ) {
    for (const channel of channels) {
      const notification = await this.prisma.notification.create({
        data: { userId, type, payload: payload as Prisma.InputJsonValue, channel },
      });

      if (channel === 'email') {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const subjectFn = NOTIFICATION_SUBJECTS[type];
          await this.mail.send(
            user.email,
            subjectFn ? subjectFn(payload) : `Task Management notification: ${type}`,
            JSON.stringify(payload, null, 2),
          );
        }
        await this.prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
      }
    }
  }

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
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
