/**
 * FCM-based push notification registration (plan §1.13).
 *
 * Reuses the existing Firebase app singleton from lib/firebase/client.ts to avoid the
 * double-import Rollup warning. Uses dynamic import() only for firebase/messaging (which
 * is not imported anywhere else in the app) so that chunk stays lazy.
 *
 * Environment variables expected (set in apps/web/.env.local):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *   VITE_FIREBASE_APP_ID, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_VAPID_KEY
 *
 * If ANY are missing, the module skips silently (no crash in CI / unconfig'd envs).
 */

import { firebaseEnabled } from '../firebase/client';
import { getAccessToken } from '../auth/getAccessToken';

let registrationAttempted = false;

export async function registerPushNotifications(userId: string): Promise<void> {
  // Idempotent — only attempt once per page load.
  if (registrationAttempted) return;
  registrationAttempted = true;

  // Guard: firebase not configured, or browser doesn't support push.
  if (!firebaseEnabled) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey) {
    if (import.meta.env.DEV) console.info('[push] VITE_FIREBASE_VAPID_KEY not set — push skipped.');
    return;
  }

  try {
    // Lazy-import only firebase/messaging (not bundled elsewhere).
    const { getApps } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    // Reuse the already-initialized app from lib/firebase/client.ts.
    const existingApp = getApps()[0];
    if (!existingApp) {
      console.warn('[push] Firebase app not initialized yet — push skipped.');
      return;
    }

    const messaging = getMessaging(existingApp);

    // Request notification permission (no-op if already 'granted').
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Register the FCM service worker.
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
    await fetch(`${apiBase}/api/v1/notification-preferences/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ token, user_id: userId }),
    });

    // Foreground message handler — shows a browser notification when the tab is focused.
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? 'Pulse';
      const body  = payload.notification?.body  ?? '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });

    if (import.meta.env.DEV) console.info('[push] FCM push registered successfully.');
  } catch (err) {
    // Non-fatal — push failure must never break the app.
    console.warn('[push] Push notification registration failed:', err);
  }
}
