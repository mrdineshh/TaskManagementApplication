import { useState } from 'react';
import { useCreateDepartment, useDepartmentsAdmin, useUpdateDepartment, useUsersAdmin } from '../../features/admin/hooks';

export function DepartmentsAdminPage() {
  const { data: departments, isLoading } = useDepartmentsAdmin();
  const { data: users } = useUsersAdmin();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [headToAssign, setHeadToAssign] = useState<Record<string, string>>({});

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await createDept.mutateAsync({ name, slug });
    setName('');
    setSlug('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Department name"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          placeholder="slug"
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={createDept.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Head</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {departments?.map((d) => {
              // Head must already belong to this department (docs/10-OPEN-DECISIONS.md §G1) —
              // narrows the picker instead of letting an Admin assign someone unrelated.
              const deptMembers = (users as any[])?.filter((u) => u.primary_department_id === d.id) ?? [];
              const currentHead = (users as any[])?.find((u) => u.id === d.head_user_id);
              return (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-2 text-slate-500">{d.slug}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={headToAssign[d.id] ?? d.head_user_id ?? ''}
                        onChange={(e) => setHeadToAssign((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
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
                        className="text-xs text-brand-700 hover:underline disabled:text-slate-300"
                      >
                        Set
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{d.is_active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => updateDept.mutate({ id: d.id, data: { is_active: !d.is_active } })}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      {d.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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
