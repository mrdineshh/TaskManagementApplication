import { useState } from 'react';
import { useCreateDepartment, useDepartmentsAdmin, useUpdateDepartment, useUsersAdmin } from '../../features/admin/hooks';
import { Toggle } from '../../components/Toggle';

export function DepartmentsAdminPage() {
  const { data: departments, isLoading } = useDepartmentsAdmin();
  const { data: users } = useUsersAdmin();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [headToAssign, setHeadToAssign] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await createDept.mutateAsync({ name, slug });
    setName('');
    setSlug('');
  }

  function startEdit(d: { id: string; name: string; slug: string }) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditSlug(d.slug);
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !editSlug.trim()) return;
    await updateDept.mutateAsync({ id, data: { name: editName, slug: editSlug } });
    setEditingId(undefined);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Department name"
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          placeholder="slug"
          className="w-40 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={createDept.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2" title="A URL-safe internal identifier derived from the name (e.g. 'Product Development' → 'product-development'). Used internally by the API — rarely needs changing.">
                Slug <span className="cursor-help text-slate-400">ⓘ</span>
              </th>
              <th className="px-4 py-2">Head</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {departments?.map((d) => {
              // Head must already belong to this department (docs/10-OPEN-DECISIONS.md §G1) —
              // narrows the picker instead of letting an Admin assign someone unrelated.
              const deptMembers = (users as any[])?.filter((u) => u.primary_department_id === d.id) ?? [];
              const currentHead = (users as any[])?.find((u) => u.id === d.head_user_id);
              const isEditing = editingId === d.id;
              return (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                      />
                    ) : (
                      d.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {isEditing ? (
                      <input
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        className="w-32 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                      />
                    ) : (
                      d.slug
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={headToAssign[d.id] ?? d.head_user_id ?? ''}
                        onChange={(e) => setHeadToAssign((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
                      >
                        <option value="">{currentHead ? currentHead.full_name : 'No Head assigned'}</option>
                        {deptMembers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!headToAssign[d.id] || headToAssign[d.id] === d.head_user_id}
                        onClick={() => updateDept.mutate({ id: d.id, data: { head_user_id: headToAssign[d.id] } })}
                        className="text-xs text-brand-700 dark:text-brand-300 hover:underline disabled:text-slate-300 dark:disabled:text-slate-600"
                      >
                        Set
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Toggle
                      checked={d.is_active}
                      onChange={(checked) => updateDept.mutate({ id: d.id, data: { is_active: checked } })}
                      disabled={updateDept.isPending}
                      label={`${d.is_active ? 'Deactivate' : 'Activate'} ${d.name}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(d.id)}
                          disabled={updateDept.isPending}
                          className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(undefined)} className="text-xs text-slate-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(d)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                        Edit
                      </button>
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
