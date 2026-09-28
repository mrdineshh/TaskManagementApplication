import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useSessionStore } from '../lib/auth/session-store';
import { apiClient } from '../lib/api-client/client';

const STORAGE_KEY = (userId: string) => `taskapp.dept_confirmed.${userId}`;

/** Returns true when the user still needs to pick/confirm their department. */
export function shouldShowDepartmentPicker(userId: string): boolean {
  return !localStorage.getItem(STORAGE_KEY(userId));
}

export function dismissDepartmentPicker(userId: string): void {
  localStorage.setItem(STORAGE_KEY(userId), '1');
}

interface Department {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

interface DepartmentPickerModalProps {
  onDone: () => void;
}

/**
 * Blocking first-login modal shown once per device when a new employee has
 * not yet confirmed their department. Non-skippable so RBAC scoping is
 * correct before the user touches any task data.
 *
 * Calls PATCH /me/department — no user.manage permission required.
 */
export function DepartmentPickerModal({ onDone }: DepartmentPickerModalProps) {
  const currentUser = useSessionStore((s) => s.currentUser);
  const accessToken = useSessionStore((s) => s.accessToken);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const setTokens = useSessionStore((s) => s.setTokens);
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(
    (currentUser as any)?.primary_department_id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

  useEffect(() => {
    fetch(`${apiBase}/api/v1/departments`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data.items ?? []);
        setDepartments(list.filter((d: any) => d.is_active !== false));
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, [accessToken, apiBase]);

  async function confirm() {
    if (!selected || !currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/me/department`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ department_id: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Could not save department selection');
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
          // Non-fatal — the department is saved; user can reload to get updated token.
        }
      }

      // Re-fetch /me so currentUser reflects the new primary_department_id.
      try {
        const me = await apiClient.me.get();
        setCurrentUser(me as never);
      } catch {
        // Best-effort.
      }

      dismissDepartmentPicker(currentUser.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl neu-card !p-0 shadow-2xl">

        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800">
            <Building2 className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Welcome, {(currentUser as any)?.full_name?.split(' ')[0] ?? 'there'}!
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Before you get started, tell us which department you belong to.
            This determines which tasks and teammates you can see.
          </p>
        </div>

        {/* Department list */}
        <div className="max-h-72 overflow-y-auto px-8 py-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : departments.length === 0 ? (
            <p className="text-center text-sm text-slate-400">
              No departments found — ask your Admin to set them up first.
            </p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => {
                const isSelected = selected === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelected(dept.id)}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-400/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {dept.name}
                      </p>
                      {dept.description && (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{dept.description}</p>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-8 py-4 flex items-center justify-between gap-4">
          <p className="text-xs">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">You can change this later in your account settings.</span>
            )}
          </p>
          <button
            onClick={confirm}
            disabled={!selected || saving}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Confirm department'}
          </button>
        </div>
      </div>
    </div>
  );
}
