import { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';

const STORAGE_KEY = 'pulse.notif.banner.dismissed';

/**
 * A dashboard-level banner that prompts the user to enable push notifications.
 * Only shown when:
 *   - Notification API exists in this browser
 *   - Permission hasn't been granted or denied yet (it's 'default')
 *   - The user hasn't dismissed this banner before
 *
 * When the user clicks "Enable", THEN the browser native permission dialog is shown.
 */
export function NotificationPermissionBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1' || !('Notification' in window) || Notification.permission !== 'default'
  );
  const [requested, setRequested] = useState(false);

  if (dismissed) return null;

  async function handleEnable() {
    setRequested(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // If FCM push is set up, register the token now
        const userId = (window as any).__pulseUserId as string | undefined;
        if (userId) {
          const { registerPushNotifications } = await import('../lib/push/registerPush');
          await registerPushNotifications(userId).catch(() => {});
        }
      }
    } catch {
      // Non-fatal
    }
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-5 py-4 animate-fade-in"
      style={{
        background: "linear-gradient(135deg, rgba(37,99,235,0.07), rgba(29,78,216,0.05))",
        border: "1px solid rgba(37,99,235,0.15)",
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #2563EB, #1d4ed8)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
      >
        <Bell className="w-5 h-5 text-white" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Enable push notifications
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Get notified instantly when tasks are assigned, due, or updated — even when the tab is in the background.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleEnable}
          disabled={requested}
          className="btn-primary !py-2 !px-4 !text-sm gap-2 disabled:opacity-60"
        >
          <Bell className="w-4 h-4" />
          {requested ? 'Requesting…' : 'Enable'}
        </button>
        <button
          onClick={handleDismiss}
          className="nav-icon-btn"
          title="Not now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
