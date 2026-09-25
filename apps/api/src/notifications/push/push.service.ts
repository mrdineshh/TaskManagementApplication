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
    if (!pushToken) return;

    // 1. Expo push token relay
    if (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken[')) {
      try {
        const res = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify([{ to: pushToken, title, body, sound: 'default' }]),
        });

        const result = (await res.json()) as { data?: { status: string; message?: string }[] };
        const ticket = result.data?.[0];
        if (!res.ok || ticket?.status === 'error') {
          this.logger.warn(`Expo push failed for ${pushToken}: ${ticket?.message ?? res.statusText}`);
          return;
        }
        this.logger.log(`Push sent via Expo to ${pushToken} title="${title}"`);
      } catch (err) {
        this.logger.warn(`Expo push request failed: ${(err as Error).message}`);
      }
      return;
    }

    // 2. Direct FCM push token via Firebase Admin (GCP / Firebase direct)
    try {
      const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');

      if (!getApps().length) {
        initializeApp({ credential: applicationDefault() });
      }

      await getMessaging().send({
        token: pushToken,
        notification: {
          title,
          body,
        },
      });
      this.logger.log(`FCM push sent to ${pushToken} title="${title}"`);
    } catch (err) {
      this.logger.warn(`FCM direct push skipped/failed for ${pushToken}: ${(err as Error).message}`);
    }
  }
}

