import { useState } from 'react';
import { useCreateDepartment, useDepartmentsAdmin, useUpdateDepartment } from '../../features/admin/hooks';

export function DepartmentsAdminPage() {
  const { data: departments, isLoading } = useDepartmentsAdmin();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

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
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {departments?.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                <td className="px-4 py-2 text-slate-500">{d.slug}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
