import { useEffect, useState } from 'react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '../../features/admin/hooks';

export function OrgSettingsAdminPage() {
  const { data } = useOrganizationSettings();
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
    <form onSubmit={handleSave} className="max-w-md space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Organization name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Timezone (IANA)</label>
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
      </div>
      <button type="submit" className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        Save
      </button>
    </form>
  );
}
