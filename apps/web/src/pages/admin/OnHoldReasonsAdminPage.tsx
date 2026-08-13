import { useState } from 'react';
import { apiClient } from '../../lib/api-client/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function useOnHoldReasonsAdmin() {
  return useQuery({ queryKey: ['on-hold-reasons'], queryFn: () => apiClient.onHoldReasons.list() });
}
function useCreateOnHoldReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => apiClient.onHoldReasons.create(label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['on-hold-reasons'] }),
  });
}
function useToggleOnHoldReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.onHoldReasons.update(id, { is_active: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['on-hold-reasons'] }),
  });
}

/** Admin-configurable On-Hold reasons (docs/10-OPEN-DECISIONS.md §H1) — picked by the assignee
 * whenever a task moves into a status flagged "requires a hold reason" (e.g. On Hold). */
export function OnHoldReasonsAdminPage() {
  const { data: reasons, isLoading } = useOnHoldReasonsAdmin();
  const createReason = useCreateOnHoldReason();
  const toggleReason = useToggleOnHoldReason();
  const [label, setLabel] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await createReason.mutateAsync(label);
    setLabel('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Reason label (e.g. Waiting for Legal)"
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={createReason.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {reasons?.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{r.label}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggleReason.mutate({ id: r.id, isActive: !r.is_active })}
                    className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    {r.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
