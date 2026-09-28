import { useState } from 'react';
import { useCreateDepartment, useDepartmentsAdmin, useUpdateDepartment, useUsersAdmin } from '../../features/admin/hooks';
import { Toggle } from '../../components/Toggle';
import { Spinner } from '../../components/Spinner';
import { NeuSelect } from '../../components/NeuSelect';

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
      <form onSubmit={handleCreate} className="flex gap-2 neu-card !p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Department name"
          className="flex-1 neu-input"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          placeholder="slug"
          className="w-40 neu-input"
        />
        <button
          type="submit"
          disabled={createDept.isPending}
          className="flex items-center gap-2 btn-primary"
        >
          {createDept.isPending && <Spinner className="h-4 w-4" />}
          {createDept.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead
            className="text-left text-xs font-semibold uppercase tracking-wider"
            style={{ borderBottom: "1px solid var(--neu-dark)", color: "var(--text-faint)", background: "var(--neu-bg)" }}
          >
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3" title="A URL-safe internal identifier derived from the name. Used internally by the API.">
                Slug <span className="cursor-help" style={{ color: "var(--text-faint)" }}>ⓘ</span>
              </th>
              <th className="px-4 py-3">Head</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {departments?.map((d) => {
              const deptMembers = (users as any[])?.filter((u) => u.primary_department_id === d.id) ?? [];
              const isEditing = editingId === d.id;
              const currentVal = headToAssign[d.id] !== undefined ? headToAssign[d.id] : (d.head_user_id ?? '');

              const headOptions = [
                { value: '', label: 'No Head assigned' },
                ...deptMembers.map((u) => ({ value: u.id, label: u.full_name })),
              ];

              return (
                <tr
                  key={d.id}
                  style={{ borderBottom: "1px solid var(--neu-dark)" }}
                  className="hover:bg-[rgba(37,99,235,0.03)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium break-words leading-snug" style={{ color: "var(--text-primary)" }}>
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full neu-input !py-1 text-sm"
                      />
                    ) : (
                      d.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {isEditing ? (
                      <input
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        className="w-32 neu-input !py-1 text-sm"
                      />
                    ) : (
                      d.slug
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <NeuSelect
                        value={currentVal}
                        onChange={(v) => setHeadToAssign((prev) => ({ ...prev, [d.id]: v }))}
                        options={headOptions}
                        placeholder="No Head assigned"
                        compact
                        style={{ minWidth: '180px' }}
                      />
                      <button
                        type="button"
                        disabled={headToAssign[d.id] === undefined || headToAssign[d.id] === (d.head_user_id ?? '') || updateDept.isPending}
                        onClick={async () => {
                          const targetVal = headToAssign[d.id];
                          await updateDept.mutateAsync({
                            id: d.id,
                            data: { head_user_id: targetVal ? targetVal : null },
                          });
                          setHeadToAssign((prev) => {
                            const next = { ...prev };
                            delete next[d.id];
                            return next;
                          });
                        }}
                        className="text-xs font-semibold px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ color: "#2563EB" }}
                      >
                        Set
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={d.is_active}
                      onChange={(checked) => updateDept.mutate({ id: d.id, data: { is_active: checked } })}
                      disabled={updateDept.isPending}
                      label={`${d.is_active ? 'Deactivate' : 'Activate'} ${d.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(d.id)}
                          disabled={updateDept.isPending}
                          className="text-xs font-semibold hover:underline disabled:opacity-50"
                          style={{ color: "#2563EB" }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(undefined)}
                          className="text-xs hover:underline"
                          style={{ color: "var(--text-faint)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(d)}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: "#2563EB" }}
                      >
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
