import { useState } from 'react';
import { AlertTriangle, Loader2, Shield, ShieldAlert, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import {
  useAssignRole,
  useDeleteUser,
  useDepartmentsAdmin,
  useInviteUser,
  useRemoveRole,
  useRoles,
  useUpdateUser,
  useUsersAdmin,
} from '../../features/admin/hooks';
import { CountryStateSelect } from '../../components/CountryStateSelect';
import { NeuSelect } from '../../components/NeuSelect';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function UsersAdminPage() {
  const { data: users, isLoading } = useUsersAdmin();
  const { data: departments } = useDepartmentsAdmin();
  const { data: roles } = useRoles();
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const [userToDelete, setUserToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const displayUsers = (users as any[])?.filter(
    (u) => u.is_active !== false && !deletedIds.includes(u.id)
  ) ?? [];

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editState, setEditState] = useState('');

  function startEdit(u: { id: string; full_name: string; work_country: string; work_state: string }) {
    setEditingId(u.id);
    setEditName(u.full_name);
    setEditCountry(u.work_country);
    setEditState(u.work_state);
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !editCountry || !editState) return;
    await updateUser.mutateAsync({ id, data: { full_name: editName, work_country: editCountry, work_state: editState } });
    setEditingId(undefined);
  }

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [workCountry, setWorkCountry] = useState('');
  const [workState, setWorkState] = useState('');
  const [managerId, setManagerId] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<Record<string, string>>({});

  const managerOptions = displayUsers.filter((u) => u.primary_department_id === departmentId);
  const adminRole = roles?.find((r) => r.name === 'Admin');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !departmentId || !workCountry.trim() || !workState.trim()) return;
    await inviteUser.mutateAsync({
      email,
      full_name: fullName,
      primary_department_id: departmentId,
      work_country: workCountry,
      work_state: workState,
      manager_id: managerId || undefined,
      role_ids: inviteRoleId ? [inviteRoleId] : undefined,
    });
    setEmail('');
    setFullName('');
    setWorkCountry('');
    setWorkState('');
    setManagerId('');
    setInviteRoleId('');
  }

  const selCls = 'neu-input text-sm cursor-pointer appearance-none';

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <form onSubmit={handleInvite} className="neu-card !p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="neu-input" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@econz.net" className="neu-input" />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Department</label>
          <NeuSelect
            value={departmentId}
            onChange={(v) => { setDepartmentId(v); setManagerId(''); }}
            options={[...(departments ?? [])].map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Department…"
            style={{ width: '100%' }}
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Role</label>
          <NeuSelect
            value={inviteRoleId}
            onChange={setInviteRoleId}
            options={[...(roles ?? [])].map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Employee (default)…"
            style={{ width: '100%' }}
          />
        </div>
        <div className="min-w-[200px]">
          <CountryStateSelect country={workCountry} state={workState} onCountryChange={setWorkCountry} onStateChange={setWorkState} />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Reports to</label>
          <NeuSelect
            value={managerId}
            onChange={setManagerId}
            options={managerOptions.map((u: any) => ({ value: u.id, label: u.full_name }))}
            placeholder="Reports to (optional)…"
            disabled={!departmentId}
            style={{ width: '100%' }}
          />
        </div>
        <button type="submit" className="btn-primary shrink-0 gap-2">
          <UserPlus className="w-4 h-4" />
          Invite
        </button>
      </form>

      {/* Users table */}
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "auto", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--neu-dark)" }}>
              {["Name", "Email", "Region", "Reports to", "Roles", "Admin Access", "Assign Role", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)", background: "var(--neu-bg)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && displayUsers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No active users found.
                </td>
              </tr>
            )}
            {displayUsers.map((u) => {
              const isEditing = editingId === u.id;
              const hasAdminRole = u.roles?.some((r: any) => r.name === 'Admin');
              const adminRoleObj = u.roles?.find((r: any) => r.name === 'Admin');

              return (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--neu-dark)" }} className="hover:bg-[rgba(37,99,235,0.03)] transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3 font-semibold min-w-[130px]" style={{ color: "var(--text-primary)" }}>
                    {isEditing ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full neu-input !py-1 text-sm" />
                    ) : (
                      <span className="break-words leading-snug">{u.full_name}</span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 min-w-[170px]" style={{ color: "var(--text-muted)" }}>
                    <span className="break-all text-xs">{u.email}</span>
                  </td>

                  {/* Region */}
                  <td className="px-4 py-3 min-w-[120px]" style={{ color: "var(--text-muted)" }}>
                    {isEditing ? (
                      <CountryStateSelect country={editCountry} state={editState} onCountryChange={setEditCountry} onStateChange={setEditState} />
                    ) : (
                      <span className="text-xs">{u.work_country}{u.work_state ? `, ${u.work_state}` : ''}</span>
                    )}
                  </td>

                  {/* Reports to */}
                  <td className="px-4 py-3 min-w-[110px]" style={{ color: "var(--text-muted)" }}>
                    <span className="text-xs break-words leading-snug">{(users as any[])?.find((m) => m.id === u.manager_id)?.full_name ?? '—'}</span>
                  </td>

                  {/* Roles */}
                  <td className="px-4 py-3 min-w-[100px]">
                    <div className="flex flex-wrap gap-1">
                      {u.roles?.map((r: any) => {
                        const isAdmin = r.name === 'Admin';
                        return (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={isAdmin
                              ? { background: "rgba(37,99,235,0.12)", color: "#2563EB" }
                              : { background: "var(--neu-dark)", color: "var(--text-muted)" }}
                          >
                            {isAdmin && <ShieldCheck className="w-3 h-3" />}
                            {r.name}
                            <button onClick={() => removeRole.mutate({ userId: u.id, roleId: r.id })} className="ml-0.5 hover:text-red-500" title={`Remove ${r.name}`}>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* Admin Access */}
                  <td className="px-4 py-3 min-w-[120px]">
                    {hasAdminRole ? (
                      <button
                        type="button"
                        onClick={() => adminRoleObj && removeRole.mutate({ userId: u.id, roleId: adminRoleObj.id })}
                        disabled={removeRole.isPending}
                        className="inline-flex items-center gap-1.5 btn-danger !py-1 !px-2.5 !text-xs !rounded-lg disabled:opacity-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Revoke Admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => adminRole && assignRole.mutate({ userId: u.id, roleId: adminRole.id })}
                        disabled={assignRole.isPending || !adminRole}
                        className="inline-flex items-center gap-1.5 btn-neu !py-1 !px-2.5 !text-xs !rounded-lg disabled:opacity-50"
                        style={{ color: "#7c3aed" }}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Grant Admin
                      </button>
                    )}
                  </td>

                  {/* Assign Role */}
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <NeuSelect
                        value={roleToAssign[u.id] ?? ''}
                        onChange={(v) => setRoleToAssign((prev) => ({ ...prev, [u.id]: v }))}
                        options={(roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
                        placeholder="Select role…"
                        compact
                        style={{ minWidth: '120px', flex: 1 }}
                      />
                      <button
                        onClick={() => {
                          const selectedRoleId = roleToAssign[u.id];
                          if (!selectedRoleId) return;
                          const roleObj = roles?.find((r) => r.id === selectedRoleId);
                          const isSelectedAdmin = roleObj?.name === 'Admin';
                          assignRole.mutate({
                            userId: u.id,
                            roleId: selectedRoleId,
                            departmentId: isSelectedAdmin ? undefined : u.primary_department_id,
                          });
                          setRoleToAssign((prev) => ({ ...prev, [u.id]: '' }));
                        }}
                        className="btn-primary !py-1 !px-2.5 !text-xs shrink-0"
                      >
                        Assign
                      </button>
                    </div>
                  </td>


                  {/* Status */}
                  <td className="px-4 py-3 min-w-[130px]">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={u.is_active
                          ? { background: "rgba(16,185,129,0.1)", color: "#10b981" }
                          : { background: "var(--neu-dark)", color: "var(--text-faint)" }}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUserToDelete({ id: u.id, fullName: u.full_name })}
                        disabled={deleteUser.isPending}
                        className="text-xs font-medium disabled:opacity-50 hover:underline flex items-center gap-1"
                        style={{ color: "#ef4444" }}
                        title={`Delete ${u.full_name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </td>

                  {/* Edit */}
                  <td className="px-4 py-3 min-w-[80px] text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => saveEdit(u.id)} disabled={updateUser.isPending} className="text-xs font-semibold disabled:opacity-50" style={{ color: "#2563EB" }}>Save</button>
                        <button onClick={() => setEditingId(undefined)} className="text-xs" style={{ color: "var(--text-faint)" }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(u)} className="text-xs font-semibold hover:underline" style={{ color: "#2563EB" }}>Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <ConfirmDialog
          title="Delete User"
          message={`Are you sure you want to permanently delete "${userToDelete.fullName}"? All tasks created by this user will be preserved and reassigned, assigned tasks will be unassigned, and this user account will be permanently removed. This action cannot be undone.`}
          confirmLabel={deleteUser.isPending ? "Deleting…" : "Delete User"}
          variant="danger"
          onConfirm={async () => {
            const id = userToDelete.id;
            setDeletedIds((prev) => [...prev, id]);
            setUserToDelete(null);
            await deleteUser.mutateAsync(id);
          }}
          onCancel={() => setUserToDelete(null)}
        />
      )}
    </div>
  );
}
