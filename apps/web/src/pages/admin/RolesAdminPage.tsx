import { useEffect, useState } from 'react';
import {
  useCreateRole,
  useDeleteRole,
  useDepartmentsAdmin,
  usePermissionKeys,
  useRoles,
  useUpdateRole,
} from '../../features/admin/hooks';

/**
 * Role editor: name, scope, and a permission matrix grouped by resource
 * (docs/06-FRONTEND-WEB.md §6) — the checkbox grid is the "novel" part of this screen.
 */
export function RolesAdminPage() {
  const { data: roles } = useRoles();
  const { data: permissions } = usePermissionKeys();
  const { data: departments } = useDepartmentsAdmin();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles?.find((r) => r.id === selectedId);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [checkedPermissions, setCheckedPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDepartmentId(selected.department_id ?? '');
      setCheckedPermissions(new Set(selected.permission_keys));
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = new Map<string, string[]>();
  for (const p of permissions ?? []) {
    const [resource] = p.key.split('.');
    grouped.set(resource, [...(grouped.get(resource) ?? []), p.key]);
  }

  function togglePermission(key: string) {
    setCheckedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedId) return;
    await updateRole.mutateAsync({
      id: selectedId,
      data: { name, department_id: departmentId || null, permission_keys: [...checkedPermissions] },
    });
  }

  async function handleCreate() {
    const role = await createRole.mutateAsync({ name: 'New Role', permission_keys: [] });
    setSelectedId((role as { id: string }).id);
  }

  return (
    <div className="flex gap-6">
      <div className="w-56 shrink-0 space-y-2">
        <button
          onClick={handleCreate}
          className="w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New Role
        </button>
        <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {roles?.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelectedId(r.id)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  selectedId === r.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {r.name}
                {r.is_system_role && <span className="ml-1 text-xs text-slate-400">(system)</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="flex-1 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Org-wide</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {[...grouped.entries()].map(([resource, keys]) => (
              <div key={resource}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{resource}</p>
                <div className="flex flex-wrap gap-3">
                  {keys.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checkedPermissions.has(key)}
                        onChange={() => togglePermission(key)}
                        disabled={selected.is_system_role && selected.name === 'Admin'}
                      />
                      {key.split('.')[1]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
            <button
              onClick={handleSave}
              disabled={updateRole.isPending}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Save
            </button>
            {!selected.is_system_role && (
              <button
                onClick={() => {
                  deleteRole.mutate(selected.id);
                  setSelectedId(null);
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Delete role
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
