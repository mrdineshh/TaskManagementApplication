import { useEffect, useState } from 'react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '../../features/admin/hooks';
import { Settings, Loader2 } from 'lucide-react';

export function OrgSettingsAdminPage() {
  const { data, isLoading } = useOrganizationSettings();
  const update = useUpdateOrganizationSettings();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    if (data) {
      setName((data as any).name ?? '');
      setTimezone((data as any).timezone ?? '');
    }
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ name, timezone });
  }

  return (
    <div className="max-w-md space-y-4">
      <form onSubmit={handleSave} className="space-y-5 neu-card">
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: "1px solid var(--neu-dark)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #2563EB22, #1d4ed822)", color: "#2563EB" }}>
            <Settings className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Organization Settings</h2>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading settings...</div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Organization Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="eConz Enterprise"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Timezone (IANA)</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={update.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
