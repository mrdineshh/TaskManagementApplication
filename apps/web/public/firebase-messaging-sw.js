// Firebase Cloud Messaging service worker (plan §1.13).
// Handles background push notifications when the browser tab is closed / not focused.
// This file must live in the web app's public/ root so it can be registered at the
// root scope — Vite serves files in public/ as-is at /.
//
// Env vars: these are baked in at build time via import.meta.env but service workers
// cannot use ES module imports from Vite. Instead, the values must be substituted at
// build time. For now, replace the %%VITE_*%% placeholders with their actual values
// using a Vite plugin or a simple sed script in the build pipeline.
// For local dev, Firebase emulator can be used without this file.

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            '%%VITE_FIREBASE_API_KEY%%',
  authDomain:        '%%VITE_FIREBASE_AUTH_DOMAIN%%',
  projectId:         '%%VITE_FIREBASE_PROJECT_ID%%',
  messagingSenderId: '%%VITE_FIREBASE_MESSAGING_SENDER_ID%%',
  appId:             '%%VITE_FIREBASE_APP_ID%%',
});

const messaging = firebase.messaging();

// Background message handler — shows a notification when the app is not in the foreground.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'TaskApp';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data,
  });
});

// Click handler — opens the relevant task page when the user taps the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const url = taskId ? `/tasks/${taskId}` : '/';
  event.waitUntil(clients.openWindow(url));
});
