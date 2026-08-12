import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Requests push permission and registers the Expo push token with the backend
 * (docs/05-FEATURES.md §2.6, v1.1). The actual FCM send stays mocked server-side
 * (apps/api/src/notifications/push/push.service.ts) until a real Firebase project
 * exists — this registers the real token regardless, so the round trip is already
 * correct and only the last-mile send needs swapping in later.
 */
export function usePushNotifications() {
  const currentUser = useSessionStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function register() {
      if (!Device.isDevice) return; // push tokens aren't meaningful on the simulator

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync();
      if (!cancelled) {
        await apiClient.me.registerPushToken(token).catch(() => {
          // non-fatal — user can still use the app without push
        });
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);
}
