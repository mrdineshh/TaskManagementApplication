import { Injectable, Logger } from '@nestjs/common';

/**
 * Push notifications via Firebase Cloud Messaging (v1.1, docs/05-FEATURES.md §2.6). Same
 * mocked pattern as MailService: until a real Firebase project exists, this logs the "sent"
 * push instead of calling the FCM API, so the notification flow (including the mobile
 * registration round trip) is exercisable end-to-end against mocked data.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(pushToken: string, title: string, body: string): Promise<void> {
    this.logger.log(`[mock push — FCM not yet configured] to=${pushToken} title="${title}" body="${body}"`);
  }
}
