import { useEffect, useState } from 'react';
import { Users, UserPlus, X, ShieldCheck } from 'lucide-react';
import { NeuSelect } from '../../components/NeuSelect';
import {
  useAssignRole,
  useCreateRole,
  useDeleteRole,
  useDepartmentsAdmin,
  usePermissionKeys,
  useRemoveRole,
  useRoles,
  useUpdateRole,
  useUsersAdmin,
} from '../../features/admin/hooks';

/**
 * Role editor: name, scope, assigned users, and a permission matrix grouped by resource
 * (docs/06-FRONTEND-WEB.md §6).
 */
export function RolesAdminPage() {
  const { data: roles } = useRoles();
  const { data: permissions } = usePermissionKeys();
  const { data: departments } = useDepartmentsAdmin();
  const { data: users } = useUsersAdmin();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles?.find((r) => r.id === selectedId);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [checkedPermissions, setCheckedPermissions] = useState<Set<string>>(new Set());
  const [userToAssignId, setUserToAssignId] = useState('');

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDepartmentId(selected.department_id ?? '');
      setCheckedPermissions(new Set(selected.permission_keys));
      setUserToAssignId('');
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedUsers = (users as any[])?.filter((u) =>
    u.roles?.some((r: any) => r.id === selected?.id || r.name === selected?.name)
  ) ?? [];

  const unassignedUsers = (users as any[])?.filter(
    (u) => !u.roles?.some((r: any) => r.id === selected?.id || r.name === selected?.name)
  ) ?? [];

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

  async function handleAssignUser() {
    if (!userToAssignId || !selected) return;
    const targetUser = (users as any[])?.find((u) => u.id === userToAssignId);
    const isSelectedAdmin = selected.name === 'Admin';
    await assignRole.mutateAsync({
      userId: userToAssignId,
      roleId: selected.id,
      departmentId: isSelectedAdmin ? undefined : targetUser?.primary_department_id,
    });
    setUserToAssignId('');
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-56 shrink-0 space-y-2">
        <button
          onClick={handleCreate}
          className="w-full btn-primary transition-colors"
        >
          + New Role
        </button>
        <ul className="neu-card !p-0 overflow-hidden">
          {roles?.map((r) => {
            const count = (users as any[])?.filter((u) =>
              u.roles?.some((ur: any) => ur.id === r.id || ur.name === r.name)
            ).length ?? 0;
            return (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`flex items-center justify-between w-full px-3 py-2 text-left text-sm ${
                    selectedId === r.id
                      ? 'bg-brand-50 dark:bg-brand-950/40 font-semibold text-brand-700 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950'
                  }`}
                >
                  <span className="truncate">
                    {r.name}
                    {r.is_system_role && <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">(system)</span>}
                  </span>
                  <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected ? (
        <div className="flex-1 space-y-5 neu-card">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Role Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={selected.is_system_role && selected.name === 'Admin'}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm disabled:opacity-60"
              />
            </div>
            <div className="w-56">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Scope</label>
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
          </div>

          {/* Assigned Team Members */}
          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                  Assigned Team Members ({assignedUsers.length})
                </h3>
              </div>

              {unassignedUsers.length > 0 && (
                <div className="flex items-center gap-2">
                  <NeuSelect
                    value={userToAssignId}
                    onChange={setUserToAssignId}
                    options={[
                      { value: '', label: `Assign user to ${selected.name}…` },
                      ...unassignedUsers.map((u) => ({ value: u.id, label: `${u.full_name} (${u.email})` })),
                    ]}
                    placeholder={`Assign user to ${selected.name}…`}
                    compact
                    style={{ minWidth: '200px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAssignUser}
                    disabled={!userToAssignId || assignRole.isPending}
                    className="inline-flex items-center gap-1 rounded bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Assign
                  </button>
                </div>
              )}
            </div>

            {assignedUsers.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                No users currently hold the {selected.name} role.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {assignedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-800 dark:text-slate-200 shadow-sm"
                  >
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-[11px] text-slate-400">({departments?.find((d) => d.id === u.primary_department_id)?.name ?? 'Org'})</span>
                    <button
                      type="button"
                      onClick={() => removeRole.mutate({ userId: u.id, roleId: selected.id })}
                      disabled={removeRole.isPending}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 ml-0.5"
                      title={`Remove ${selected.name} from ${u.full_name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Role Permissions Matrix
            </h3>
            {[...grouped.entries()].map(([resource, keys]) => (
              <div key={resource} className="rounded-md border border-slate-100 dark:border-slate-800/80 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-brand-700 dark:text-brand-300">{resource}</p>
                <div className="flex flex-wrap gap-3">
                  {keys.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkedPermissions.has(key)}
                        onChange={() => togglePermission(key)}
                        disabled={selected.is_system_role && selected.name === 'Admin'}
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-600"
                      />
                      <span>{key.split('.')[1]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              onClick={handleSave}
              disabled={updateRole.isPending}
              className="btn-primary"
            >
              {updateRole.isPending ? 'Saving…' : 'Save changes'}
            </button>
            {!selected.is_system_role && (
              <button
                onClick={() => {
                  deleteRole.mutate(selected.id);
                  setSelectedId(null);
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Delete role
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400">
          Select a role on the left to edit permissions and view assigned team members.
        </div>
      )}
    </div>
  );
}
