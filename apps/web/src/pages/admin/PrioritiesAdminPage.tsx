import { useState } from 'react';
import { useCreatePriority, useDeletePriority, usePrioritiesAdmin, useUpdatePriority } from '../../features/admin/hooks';
import { Badge } from '../../components/Badge';

export function PrioritiesAdminPage() {
  const { data: priorities } = usePrioritiesAdmin();
  const createPriority = useCreatePriority();
  const updatePriority = useUpdatePriority();
  const deletePriority = useDeletePriority();

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');

  function startEdit(p: { id: string; label: string; color: string | null }) {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditColor(p.color ?? '#3b82f6');
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return;
    await updatePriority.mutateAsync({ id, data: { label: editLabel, color: editColor } });
    setEditingId(undefined);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || !label.trim()) return;
    await createPriority.mutateAsync({
      key,
      label,
      color,
      display_order: priorities?.length ?? 0,
      department_id: null,
      is_default: false,
    });
    setKey('');
    setLabel('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="w-32 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-40 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-slate-300 dark:border-slate-700" />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Add priority
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Preview</th>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Default</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {priorities?.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-10 rounded border border-slate-300 dark:border-slate-700" />
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-32 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                        />
                      </div>
                    ) : (
                      <Badge label={p.label} color={p.color} />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{p.key}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => updatePriority.mutate({ id: p.id, data: { is_default: !p.is_default } })}
                      className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      {p.is_default ? 'Default' : 'Set default'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={updatePriority.isPending}
                          className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(undefined)} className="text-xs text-slate-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(p)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => deletePriority.mutate(p.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
