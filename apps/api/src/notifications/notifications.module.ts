import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail/mail.service';
import { PushService } from './push/push.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MailService, PushService],
  exports: [NotificationsService, MailService, PushService],
})
export class NotificationsModule {}
