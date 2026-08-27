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
import { CountryStateSelect } from '../../components/CountryStateSelect';

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
  const [workCountry, setWorkCountry] = useState('');
  const [workState, setWorkState] = useState('');
  const [managerId, setManagerId] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<Record<string, string>>({});

  // "Reports to" (docs/10-OPEN-DECISIONS.md §G1) — only makes sense within the same
  // department, so the manager options narrow to whoever's already in the chosen department.
  const managerOptions = (users as any[])?.filter((u) => u.primary_department_id === departmentId) ?? [];

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
    });
    setEmail('');
    setFullName('');
    setWorkCountry('');
    setWorkState('');
    setManagerId('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex flex-wrap gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@econz.net"
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setManagerId(''); // manager options depend on department — reset when it changes
          }}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        >
          <option value="">Department…</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <CountryStateSelect country={workCountry} state={workState} onCountryChange={setWorkCountry} onStateChange={setWorkState} />
        <select
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          disabled={!departmentId}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-500"
        >
          <option value="">Reports to (optional)…</option>
          {managerOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Invite
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Reports to</th>
              <th className="px-4 py-2">Roles</th>
              <th className="px-4 py-2">Assign role</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {(users as any[])?.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{u.full_name}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {u.work_country}
                  {u.work_state ? `, ${u.work_state}` : ''}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {(users as any[])?.find((m) => m.id === u.manager_id)?.full_name ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles?.map((r: any) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">
                        {r.name}
                        <button
                          onClick={() => removeRole.mutate({ userId: u.id, roleId: r.id })}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
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
                      className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
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
                      className="text-xs text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      Assign
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => deactivate.mutate(u.id)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400">
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
