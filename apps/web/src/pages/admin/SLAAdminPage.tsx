import { useState } from 'react';
import { useCreateSLAPolicy, useDeleteSLAPolicy, useDepartmentsAdmin, useSLAPolicies, useUpdateSLAPolicy } from '../../features/admin/hooks';
import { NeuSelect } from '../../components/NeuSelect';

/** SLA policy management (docs/05-FEATURES.md §2.2) — response/resolution times + escalation rules per department. */
export function SLAAdminPage() {
  const { data: policies } = useSLAPolicies();
  const { data: departments } = useDepartmentsAdmin();
  const createPolicy = useCreateSLAPolicy();
  const updatePolicy = useUpdateSLAPolicy();
  const deletePolicy = useDeleteSLAPolicy();

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [responseMinutes, setResponseMinutes] = useState('60');
  const [resolutionMinutes, setResolutionMinutes] = useState('480');

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [editResolution, setEditResolution] = useState('');

  function startEdit(p: { id: string; name: string; response_time_minutes: number; resolution_time_minutes: number }) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditResponse(String(p.response_time_minutes));
    setEditResolution(String(p.resolution_time_minutes));
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await updatePolicy.mutateAsync({
      id,
      data: { name: editName, response_time_minutes: Number(editResponse), resolution_time_minutes: Number(editResolution) },
    });
    setEditingId(undefined);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createPolicy.mutateAsync({
      name,
      department_id: departmentId || null,
      response_time_minutes: Number(responseMinutes),
      resolution_time_minutes: Number(resolutionMinutes),
      escalation_rules: [
        { percent_elapsed: 80, notify: 'assignee' },
        { percent_elapsed: 100, notify: 'assignee_manager' },
      ],
    });
    setName('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 neu-card !p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-48 neu-input" />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Department</label>
          <NeuSelect
            value={departmentId}
            onChange={setDepartmentId}
            options={[
              { value: '', label: 'Org-wide' },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            placeholder="Org-wide"
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Response (min)</label>
          <input
            type="number"
            value={responseMinutes}
            onChange={(e) => setResponseMinutes(e.target.value)}
            className="w-28 neu-input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Resolution (min)</label>
          <input
            type="number"
            value={resolutionMinutes}
            onChange={(e) => setResolutionMinutes(e.target.value)}
            className="w-28 neu-input"
          />
        </div>
        <button type="submit" className="btn-primary">
          Add policy
        </button>
      </form>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        New policies default to escalation at 80% elapsed (notify assignee) and 100% elapsed (notify assignee's manager).
      </p>

      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Response</th>
              <th className="px-4 py-2">Resolution</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {policies?.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 break-words leading-snug">
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-32 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                      />
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editResponse}
                        onChange={(e) => setEditResponse(e.target.value)}
                        className="w-20 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                      />
                    ) : (
                      `${p.response_time_minutes}m`
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editResolution}
                        onChange={(e) => setEditResolution(e.target.value)}
                        className="w-20 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                      />
                    ) : (
                      `${p.resolution_time_minutes}m`
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => updatePolicy.mutate({ id: p.id, data: { is_active: !p.is_active } })}
                      className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={updatePolicy.isPending}
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
                        <button onClick={() => deletePolicy.mutate(p.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {policies?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No SLA policies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
