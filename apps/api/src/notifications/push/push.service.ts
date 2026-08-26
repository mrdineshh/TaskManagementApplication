import { Injectable, Logger } from '@nestjs/common';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/**
 * Push notifications via Expo's push service (docs/05-FEATURES.md §2.6). Mobile registers a
 * real Expo push token (apps/mobile/src/features/notifications/usePushNotifications.ts uses
 * `getExpoPushTokenAsync()`, not a raw FCM/APNs token), so delivery is a plain HTTPS call to
 * Expo's own relay — it fans the message out to FCM/APNs on our behalf. No Firebase project or
 * GCP credentials needed for this to work, unlike the Google Sign-In / SMTP paths.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(pushToken: string, title: string, body: string): Promise<void> {
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      this.logger.warn(`Skipping push — not a valid Expo push token: ${pushToken}`);
      return;
    }

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify([{ to: pushToken, title, body, sound: 'default' }]),
      });

      const result = (await res.json()) as { data?: { status: string; message?: string }[] };
      const ticket = result.data?.[0];
      if (!res.ok || ticket?.status === 'error') {
        // "DeviceNotRegistered" means the token is stale (app uninstalled, etc.) — logged, not
        // thrown, since a bad token for one user shouldn't fail the notification for anyone else.
        this.logger.warn(`Expo push failed for ${pushToken}: ${ticket?.message ?? res.statusText}`);
        return;
      }
      this.logger.log(`Push sent to ${pushToken} title="${title}"`);
    } catch (err) {
      this.logger.warn(`Expo push request failed: ${(err as Error).message}`);
    }
  }
}
