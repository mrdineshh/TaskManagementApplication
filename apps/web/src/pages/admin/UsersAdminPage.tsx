import { useState } from 'react';
import {
  useAssignRole,
  useDeactivateUser,
  useDepartmentsAdmin,
  useInviteUser,
  useRemoveRole,
  useRoles,
  useUsersAdmin,
} from '../../features/admin/hooks';

export function UsersAdminPage() {
  const { data: users, isLoading } = useUsersAdmin();
  const { data: departments } = useDepartmentsAdmin();
  const { data: roles } = useRoles();
  const inviteUser = useInviteUser();
  const deactivate = useDeactivateUser();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<Record<string, string>>({});

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !departmentId) return;
    await inviteUser.mutateAsync({ email, full_name: fullName, primary_department_id: departmentId });
    setEmail('');
    setFullName('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@econz.net"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Department…</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Invite
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Roles</th>
              <th className="px-4 py-2">Assign role</th>
              <th className="px-4 py-2">Active</th>
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
            {(users as any[])?.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles?.map((r: any) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {r.name}
                        <button
                          onClick={() => removeRole.mutate({ userId: u.id, roleId: r.id })}
                          className="text-slate-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <select
                      value={roleToAssign[u.id] ?? ''}
                      onChange={(e) => setRoleToAssign((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">Select…</option>
                      {roles?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => roleToAssign[u.id] && assignRole.mutate({ userId: u.id, roleId: roleToAssign[u.id], departmentId: u.primary_department_id })}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      Assign
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => deactivate.mutate(u.id)} className="text-xs text-slate-500 hover:text-red-600">
                    {u.is_active ? 'Deactivate' : 'Deactivated'}
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
