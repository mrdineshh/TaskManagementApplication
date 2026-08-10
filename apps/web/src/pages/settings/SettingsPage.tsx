import { useEffect, useState } from 'react';
import { notificationChannels, notificationTypes } from '@taskapp/shared-types';
import { useSessionStore } from '../../lib/auth/session-store';
import { useNotificationPreferences, useUpdateNotificationPreference, useUpdateProfile } from '../../features/settings/hooks';

const TYPE_LABELS: Record<string, string> = {
  task_assigned: 'Task assigned to you',
  task_reassigned: 'Task reassigned',
  due_soon: 'Task due soon',
  task_overdue: 'Task overdue',
  comment_mention: 'Mentioned in a comment',
  status_changed: 'Status changed on your task',
  sla_breach: 'SLA breach escalation',
  approval_requested: 'Approval requested from you',
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  email: 'Email',
  push: 'Push',
  slack: 'Slack',
};

/** Own profile + per-event notification preferences (docs/05-FEATURES.md §1.5, 06-FRONTEND-WEB.md §/settings). */
export function SettingsPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const updateProfile = useUpdateProfile();
  const { data: preferences } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.full_name);
    setAvatarUrl(currentUser.avatar_url ?? '');
  }, [currentUser]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({ full_name: fullName, avatar_url: avatarUrl || undefined });
    setSavedMessage('Profile updated.');
    setTimeout(() => setSavedMessage(null), 3000);
  }

  const prefMap = new Map((preferences ?? []).map((p) => [`${p.type}:${p.channel}`, p.enabled]));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
            <p className="text-sm text-slate-500">{currentUser?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {updateProfile.isPending ? 'Saving…' : 'Save profile'}
            </button>
            {savedMessage && <span className="text-xs text-green-600">{savedMessage}</span>}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-medium text-slate-700">Notification preferences</h2>
        <p className="mb-3 text-xs text-slate-400">Toggle which channels you receive each event on. Unchecked = off.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Event</th>
                {notificationChannels.map((channel) => (
                  <th key={channel} className="px-2 py-2 text-center">
                    {CHANNEL_LABELS[channel]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notificationTypes.map((type) => (
                <tr key={type} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{TYPE_LABELS[type] ?? type}</td>
                  {notificationChannels.map((channel) => {
                    const enabled = prefMap.get(`${type}:${channel}`) ?? true;
                    return (
                      <td key={channel} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => updatePreference.mutate({ type, channel, enabled: e.target.checked })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
