import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Building2,
  Camera,
  CheckCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  AlertTriangle,
  User,
  BellRing,
  Send,
} from 'lucide-react';
import { notificationChannels, notificationTypes } from '@taskapp/shared-types';
import { useSessionStore } from '../../lib/auth/session-store';
import { useNotificationPreferences, useUpdateNotificationPreference, useUpdateProfile } from '../../features/settings/hooks';
import {
  useDepartments,
  useArchivedTasks,
  useUnarchiveTask,
  usePermanentDeleteTask,
  usePendingActionRequests,
  useDecideTaskActionRequest,
} from '../../features/tasks/hooks';
import { NeuSelect } from '../../components/NeuSelect';
import { usePermission } from '../../lib/permissions/usePermission';
import { apiClient } from '../../lib/api-client/client';
import { resolveActiveRoleName } from '../../lib/auth/roles';
import {
  isDesktopNotificationEnabled,
  setDesktopNotificationEnabled,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  triggerTestNotification,
} from '../../lib/notifications/desktop-notifications';
import { fmtDate } from '../../lib/utils/dates';

const TYPE_LABELS: Record<string, string> = {
  task_assigned:      'Task assigned to you',
  task_reassigned:    'Task reassigned',
  due_soon:           'Task due soon',
  task_overdue:       'Task overdue',
  comment_mention:    'Mentioned in a comment',
  status_changed:     'Status changed on your task',
  sla_breach:         'SLA breach escalation',
  approval_requested: 'Approval requested from you',
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  email:  'Email',
  push:   'Push',
  slack:  'Slack',
};

export function SettingsPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);
  const accessToken = useSessionStore((s) => s.accessToken);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const setTokens = useSessionStore((s) => s.setTokens);
  const updateProfile = useUpdateProfile();
  const { data: preferences } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();
  const { data: departments, isLoading: departmentsLoading } = useDepartments();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptMessage, setDeptMessage] = useState<string | null>(null);

  const canDeleteTask = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const hasManagerRole = Boolean(
    currentUser?.roles?.some((r: any) =>
      ['Admin', 'Manager', 'Head', 'Management'].includes(typeof r === 'string' ? r : r?.name)
    )
  );
  const isManagerOrAdmin = canDeleteTask || canManageUsers || hasManagerRole;

  const [archivedSearch, setArchivedSearch] = useState('');
  const [archivedDeptId, setArchivedDeptId] = useState('');
  const { data: archivedTasks, isLoading: archivedLoading } = useArchivedTasks(archivedDeptId || undefined, archivedSearch || undefined);
  const unarchiveTask = useUnarchiveTask();
  const permanentDeleteTask = usePermanentDeleteTask();

  const { data: pendingRequests, isLoading: requestsLoading } = usePendingActionRequests();
  const decideActionRequest = useDecideTaskActionRequest();

  const activeRoleName = resolveActiveRoleName(currentUser);

  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(() => isDesktopNotificationEnabled());
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission>(() => getDesktopNotificationPermission());
  const [testingNotif, setTestingNotif] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.full_name);
    setAvatarUrl(currentUser.avatar_url ?? '');
    setSelectedDeptId((currentUser as any)?.primary_department_id ?? '');
  }, [currentUser]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({ full_name: fullName, avatar_url: avatarUrl || undefined });
    setSavedMessage('Profile updated.');
    setTimeout(() => setSavedMessage(null), 3000);
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: images only, max 5 MB before encoding
    if (!file.type.startsWith('image/')) {
      setSavedMessage('Only image files are allowed for avatars.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSavedMessage('Image must be under 5 MB. Please choose a smaller file.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);
    try {
      // Resize image to max 256Ã—256 via canvas to keep the base64 payload small.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
        img.src = objectUrl;
      });
      setAvatarUrl(dataUrl);
    } catch (err) {
      setSavedMessage(err instanceof Error ? err.message : 'Avatar read failed');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }


  async function handleSaveDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeptId || !currentUser) return;
    setDeptSaving(true);
    setDeptMessage(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/v1/me/department`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ department_id: selectedDeptId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Could not update department');
      }

      const resData = await res.json().catch(() => ({}));
      if (resData.access_token && resData.refresh_token) {
        setTokens(resData.access_token, resData.refresh_token);
      } else if (refreshToken) {
        try {
          const refreshRes = await fetch(`${apiBase}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (refreshRes.ok) {
            const tokens = await refreshRes.json();
            setTokens(tokens.access_token, tokens.refresh_token);
          }
        } catch {
          // Non-fatal â€” department is saved; user can reload to pick up new token.
        }
      }

      const me = await apiClient.me.get();
      setCurrentUser(me as never);
      setDeptMessage('Department updated successfully.');
      setTimeout(() => setDeptMessage(null), 3000);
    } catch (err) {
      setDeptMessage(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setDeptSaving(false);
    }
  }

  const prefMap = new Map((preferences ?? []).map((p) => [`${p.type}:${p.channel}`, p.enabled]));

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Manage your profile, notifications & archived tasks</p>
      </div>

      {/* Profile */}
      <section className="neu-card">
        <h2 className="mb-5 text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <User className="w-4 h-4" style={{ color: "#2563EB" }} /> Profile
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover" style={{ boxShadow: "4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)" }} />
              ) : (
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1d4ed8)" }}
                >
                  {fullName.split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white disabled:opacity-50 transition-colors"
                style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 2px 8px rgba(37,99,235,0.4)" }}
                title="Upload avatar"
              >
                {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{currentUser?.full_name}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{currentUser?.email}</p>
              {activeRoleName && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>
                  {activeRoleName}
                </span>
              )}
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="section-label">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="neu-input max-w-sm" />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="section-label">Avatar URL (or upload above)</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://â€¦" className="neu-input max-w-sm font-mono text-xs" />
          </div>

          {(currentUser as any)?.work_country && (
            <div>
              <label className="section-label">Work location</label>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {[(currentUser as any).work_state, (currentUser as any).work_country].filter(Boolean).join(', ')}
                <span className="ml-2 text-xs" style={{ color: "var(--text-faint)" }}>(set by your Admin)</span>
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={updateProfile.isPending} className="btn-primary">
              {updateProfile.isPending ? 'Savingâ€¦' : 'Save profile'}
            </button>
            {savedMessage && <span className="text-xs font-medium" style={{ color: "#10b981" }}>{savedMessage}</span>}
          </div>
        </form>
      </section>

      {/* Department & Team */}
      <section className="neu-card">
        <h2 className="mb-1 text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Building2 className="w-4 h-4" style={{ color: "#2563EB" }} /> Department & Team
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Your primary department determines which tasks and teammates are visible to you.
        </p>
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          <div>
            <label className="section-label">Primary Department</label>
            <NeuSelect
              value={selectedDeptId}
              onChange={setSelectedDeptId}
              options={[
                { value: '', label: 'Select your department…' },
                ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
              disabled={deptSaving || departmentsLoading}
              placeholder="Select your department…"
              style={{ maxWidth: '24rem' }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={deptSaving || !selectedDeptId} className="btn-primary gap-2">
              {deptSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {deptSaving ? 'Savingâ€¦' : 'Update department'}
            </button>
            {deptMessage && (
              <span className="text-xs font-medium" style={{ color: deptMessage.includes('success') ? '#10b981' : '#ef4444' }}>{deptMessage}</span>
            )}
          </div>
        </form>
      </section>

      {/* Desktop Browser Notifications */}
      <section className="neu-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <BellRing className="w-4 h-4" style={{ color: "#2563EB" }} /> Desktop Notifications
              {desktopPerm === 'granted' && desktopEnabled
                ? <span className="badge" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>Active</span>
                : desktopPerm === 'denied'
                ? <span className="badge" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>Blocked</span>
                : !desktopEnabled
                ? <span className="badge" style={{ background: "rgba(142,154,181,0.1)", color: "var(--text-faint)", border: "1px solid rgba(142,154,181,0.2)" }}>Disabled</span>
                : <span className="badge" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>Permission Required</span>}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Receive live popup alerts for assignments, mentions, and updates even when Pulse runs in a background tab.</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const val = !desktopEnabled;
                setDesktopEnabled(val);
                setDesktopNotificationEnabled(val);
                if (val && desktopPerm === 'default') {
                  const p = await requestDesktopNotificationPermission();
                  setDesktopPerm(p);
                }
              }}
              className={`neu-toggle ${desktopEnabled ? 'on' : ''}`}
              role="switch"
              aria-checked={desktopEnabled}
            />
          </div>
        </div>

        {desktopPerm === 'denied' && (
          <div className="mt-3 rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706" }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Browser notifications are blocked in your browser settings</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                To receive alerts, click the lock/settings icon next to the URL in your browser's address bar and set <strong>Notifications</strong> to <strong>Allow</strong>, then refresh.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <button
            type="button"
            disabled={testingNotif}
            onClick={async () => {
              setTestingNotif(true); setTestResult(null);
              try {
                if (desktopPerm === 'default') { const p = await requestDesktopNotificationPermission(); setDesktopPerm(p); }
                const ok = await triggerTestNotification();
                if (ok) { setTestResult({ success: true, text: 'Test notification sent! Check your desktop.' }); }
                else { const currPerm = getDesktopNotificationPermission(); setDesktopPerm(currPerm); setTestResult({ success: false, text: currPerm === 'denied' ? 'Blocked by browser â€” allow in address bar.' : 'Could not dispatch. Check system settings.' }); }
              } catch (err: any) { setTestResult({ success: false, text: err?.message || 'Error' }); }
              finally { setTestingNotif(false); setTimeout(() => setTestResult(null), 6000); }
            }}
            className="btn-neu text-xs gap-1.5"
          >
            {testingNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" style={{ color: "#2563EB" }} />}
            {testingNotif ? 'Sendingâ€¦' : 'Send Test Notification'}
          </button>
          {testResult && <span className="text-xs font-medium" style={{ color: testResult.success ? '#10b981' : '#ef4444' }}>{testResult.text}</span>}
        </div>
      </section>

      {/* Notification preferences */}
      <section className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Notification Preferences</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Toggle which channels you receive each event on.</p>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="neu-table">
            <thead>
              <tr>
                <th className="pl-2 text-left">Event</th>
                {notificationChannels.map((channel) => <th key={channel} className="text-center">{CHANNEL_LABELS[channel]}</th>)}
              </tr>
            </thead>
            <tbody>
              {notificationTypes.map((type) => (
                <tr key={type}>
                  <td className="pl-2 text-sm" style={{ color: "var(--text-primary)" }}>{TYPE_LABELS[type] ?? type}</td>
                  {notificationChannels.map((channel) => {
                    const enabled = prefMap.get(`${type}:${channel}`) ?? true;
                    return (
                      <td key={channel} className="text-center">
                        <input type="checkbox" checked={enabled} onChange={(e) => updatePreference.mutate({ type, channel, enabled: e.target.checked })} className="h-4 w-4 rounded accent-brand-500 cursor-pointer" />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Archive & Delete Requests (Managers & Admins) */}
      {isManagerOrAdmin && pendingRequests && pendingRequests.length > 0 && (
        <section className="neu-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5" style={{ color: "#f59e0b" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Pending Archive & Delete Requests</h2>
            <span className="badge" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>{pendingRequests.length}</span>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Employee requests to archive or permanently delete tasks that require your review.</p>
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Task</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th className="text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td><span className="font-semibold text-sm break-words leading-snug" style={{ color: "var(--text-primary)" }}>{req.requester?.full_name ?? 'Team Member'}</span></td>
                    <td><Link to={`/tasks/${req.task_id}`} className="font-semibold text-sm hover:underline break-words leading-snug" style={{ color: "#2563EB" }}>{req.task?.title ?? req.task_id}</Link></td>
                    <td>
                      <span className="badge" style={req.action_type === 'archive' ? { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" } : { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                        {req.action_type === 'archive' ? 'Archive' : 'Permanent Delete'}
                      </span>
                    </td>
                    <td className="max-w-xs"><span className="text-sm break-words leading-snug" style={{ color: "var(--text-muted)" }}>{req.reason || <em style={{ color: "var(--text-faint)" }}>No reason</em>}</span></td>
                    <td><span className="text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(req.created_at)}</span></td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" disabled={decideActionRequest.isPending} onClick={async () => { if (req.action_type === 'delete' && !window.confirm('Approve permanent deletion?')) return; await decideActionRequest.mutateAsync({ requestId: req.id, decision: 'approved' }); }} className="btn-primary !py-1 !px-2.5 !text-xs gap-1">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button type="button" disabled={decideActionRequest.isPending} onClick={() => decideActionRequest.mutate({ requestId: req.id, decision: 'rejected' })} className="btn-neu !py-1 !px-2.5 !text-xs gap-1">
                          <RotateCcw className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Archived Tasks Section */}
      <section className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4" style={{ color: "#2563EB" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Archived Tasks</h2>
            {archivedTasks && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>{archivedTasks.length}</span>}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input type="text" value={archivedSearch} onChange={(e) => setArchivedSearch(e.target.value)} placeholder="Search archivedâ€¦" className="neu-input pl-9 py-1.5 text-xs" style={{ minWidth: "12rem" }} />
            </div>
            <NeuSelect
              value={archivedDeptId}
              onChange={setArchivedDeptId}
              options={[
                { value: '', label: 'All Departments' },
                ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
              compact
              style={{ minWidth: '10rem' }}
            />
          </div>
        </div>

        <p className="text-xs px-5 pb-4" style={{ color: "var(--text-muted)" }}>Archived tasks are hidden from active boards. Restore or permanently delete them here.</p>

        {archivedLoading ? (
          <div className="space-y-2 p-4">{[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl skeleton" />)}</div>
        ) : !archivedTasks || archivedTasks.length === 0 ? (
          <div className="py-12 text-center">
            <Archive className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-faint)", opacity: 0.5 }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No archived tasks found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>Archived tasks will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th className="pl-5">Task Title</th>
                  <th>Department</th>
                  <th>Assignee</th>
                  <th>Archived Date</th>
                  <th className="text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="pl-5">
                      <div className="flex items-center gap-2">
                        <Link to={`/tasks/${t.id}`} className="font-semibold text-sm hover:underline break-words leading-snug" style={{ color: "var(--text-primary)" }}>{t.title}</Link>
                        {t.status && <span className="badge shrink-0 whitespace-nowrap" style={{ backgroundColor: t.status.color ? `${t.status.color}18` : 'rgba(142,154,181,0.1)', color: t.status.color ?? 'var(--text-muted)', border: `1px solid ${t.status.color ? `${t.status.color}30` : 'transparent'}` }}>{t.status.label}</span>}
                      </div>
                    </td>
                    <td><span className="text-sm break-words leading-snug" style={{ color: "var(--text-muted)" }}>{t.department?.name ?? '—'}</span></td>
                    <td><span className="text-sm break-words leading-snug" style={{ color: "var(--text-muted)" }}>{t.assignee?.fullName ?? 'Unassigned'}</span></td>
                    <td><span className="text-xs" style={{ color: "var(--text-faint)" }}>{t.deletedAt ? fmtDate(t.deletedAt) : '—'}</span></td>
                    <td className="text-right pr-5">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" disabled={unarchiveTask.isPending} onClick={() => unarchiveTask.mutate(t.id)} className="btn-neu !py-1 !px-2.5 !text-xs gap-1">
                          <RotateCcw className="w-3 h-3" /> Unarchive
                        </button>
                        {isManagerOrAdmin && (
                          <button type="button" disabled={permanentDeleteTask.isPending} onClick={() => { if (window.confirm(`Permanently delete "${t.title}"? This cannot be undone.`)) permanentDeleteTask.mutate(t.id); }} className="btn-danger !py-1 !px-2.5 !text-xs gap-1">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
