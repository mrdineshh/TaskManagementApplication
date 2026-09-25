/**
 * Universal Desktop Browser Notification Manager
 * Handles permission requests, localStorage preferences (enabled by default),
 * and triggering native desktop alerts via ServiceWorker or window.Notification.
 */

const STORAGE_KEY = 'taskapp.desktopNotificationsEnabled';

export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isDesktopNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // Default is true unless explicitly set to 'false' by user in Settings
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setDesktopNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!isDesktopNotificationSupported()) return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

export function getDesktopNotificationPermission(): NotificationPermission {
  if (!isDesktopNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function showDesktopNotification(
  title: string,
  options?: {
    body?: string;
    taskId?: string;
    tag?: string;
  }
): Promise<boolean> {
  if (!isDesktopNotificationSupported()) return false;
  if (!isDesktopNotificationEnabled()) return false;

  // If permission is default, try to request it
  if (Notification.permission === 'default') {
    const perm = await requestDesktopNotificationPermission();
    if (perm !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') return false;

  const icon = '/favicon.svg';
  const body = options?.body || 'You have a new update in Pulse.';
  const taskId = options?.taskId;
  const tag = options?.tag || taskId || 'pulse-notif';

  // Strategy 1: Use Service Worker if registered and ready (reliable across modern Chromium on HTTPS)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          tag,
          data: { taskId, url: taskId ? `/tasks/${taskId}` : '/' },
        });
        return true;
      }
    } catch {
      // Fall through to window Notification
    }
  }

  // Strategy 2: Standard Window Notification fallback
  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag,
    });

    notif.onclick = () => {
      window.focus();
      if (taskId) {
        window.location.href = `/tasks/${taskId}`;
      }
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('[desktop-notifications] Failed to show notification:', err);
    return false;
  }
}

export async function triggerTestNotification(): Promise<boolean> {
  const perm = await requestDesktopNotificationPermission();
  if (perm !== 'granted') {
    return false;
  }
  return showDesktopNotification('Pulse Notification Test', {
    body: 'Desktop notifications are working! You will receive live alerts for task updates.',
  });
}
