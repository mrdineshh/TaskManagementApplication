import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTask, useDepartments, usePriorities, useUsers } from './hooks';
import { Spinner } from '../../components/Spinner';
import { NeuSelect } from '../../components/NeuSelect';
import { NeuDatePicker } from '../../components/NeuDatePicker';
import { useSessionStore } from '../../lib/auth/session-store';
import { usePermission } from '../../lib/permissions/usePermission';

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { data: departments } = useDepartments();
  const currentUser = useSessionStore((s) => s.currentUser);
  const canDelete = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const isManagerOrAdmin = canDelete || canManageUsers || currentUser?.roles?.some((r: any) => r.name === 'Admin' || r.name === 'Manager' || r.name === 'Head');

  const defaultDeptId = (currentUser as any)?.primary_department_id ?? '';
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDeptId);
  const [priorityId, setPriorityId] = useState('');
  const [assigneeId, setAssigneeId] = useState(isManagerOrAdmin ? '' : (currentUser?.id ?? ''));
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const { data: priorities } = usePriorities(departmentId || undefined);
  // fetchAll=true for managers/admins so they see all team members (not restricted to department).
  const { data: members } = useUsers(departmentId || undefined, isManagerOrAdmin);
  const createTask = useCreateTask();
  const navigate = useNavigate();

  const userDeptIds: string[] = useMemo(() => {
    return (currentUser as any)?.department_ids?.length
      ? (currentUser as any).department_ids
      : (currentUser as any)?.primary_department_id
        ? [(currentUser as any).primary_department_id]
        : [];
  }, [currentUser]);

  const availableDepartments = useMemo(() => {
    return (departments ?? []).filter((d) =>
      isManagerOrAdmin ? true : userDeptIds.length > 0 ? userDeptIds.includes(d.id) : true,
    );
  }, [departments, isManagerOrAdmin, userDeptIds]);

  useEffect(() => {
    if (!departmentId && defaultDeptId) {
      setDepartmentId(defaultDeptId);
    } else if (!departmentId && availableDepartments.length === 1) {
      setDepartmentId(availableDepartments[0].id);
    }
    if (!assigneeId && !isManagerOrAdmin && currentUser?.id) {
      setAssigneeId(currentUser.id);
    }
  }, [defaultDeptId, currentUser?.id, isManagerOrAdmin, departmentId, availableDepartments]);

  function handleDepartmentChange(id: string) {
    setDepartmentId(id);
    if (isManagerOrAdmin) {
      setAssigneeId(''); // last department's member likely isn't in the new one
    } else {
      setAssigneeId(currentUser?.id ?? '');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !departmentId) return;
    const task = await createTask.mutateAsync({
      title,
      department_id: departmentId,
      priority_id: priorityId || undefined,
      assignee_id: assigneeId || undefined,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    onDone();
    navigate(`/tasks/${(task as { id: string }).id}`);
  }

  const deptOptions = [
    { value: '', label: 'Department…' },
    ...availableDepartments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const assigneeOptions = isManagerOrAdmin
    ? [
        { value: '', label: 'Unassigned' },
        ...((members as { id: string; full_name: string }[] | undefined) ?? []).map((m) => ({
          value: m.id,
          label: m.full_name,
        })),
      ]
    : [
        { value: currentUser?.id ?? '', label: currentUser?.full_name ? `Assigned to me (${currentUser.full_name})` : 'Assign to me' },
        { value: '', label: 'Unassigned' },
      ];

  const priorityOptions = [
    { value: '', label: 'Priority (default)' },
    ...(priorities ?? []).map((p) => ({ value: p.id, label: p.label })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3 neu-card !p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full neu-input"
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Department</label>
          <NeuSelect
            value={departmentId}
            onChange={handleDepartmentChange}
            options={deptOptions}
            placeholder="Department…"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Assignee</label>
          <NeuSelect
            value={assigneeId}
            onChange={setAssigneeId}
            options={assigneeOptions}
            placeholder="Assignee…"
            disabled={!departmentId}
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Priority</label>
          <NeuSelect
            value={priorityId}
            onChange={setPriorityId}
            options={priorityOptions}
            placeholder="Priority (default)"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Start Date</label>
          <NeuDatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Start date"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Due Date</label>
          <NeuDatePicker
            value={dueDate}
            min={startDate || undefined}
            onChange={setDueDate}
            placeholder="Due date"
            compact
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {createTask.isError && <p className="text-sm text-red-600 dark:text-red-400">{(createTask.error as Error).message}</p>}
      <button
        type="submit"
        disabled={createTask.isPending}
        className="flex items-center gap-2 btn-primary disabled:opacity-50"
      >
        {createTask.isPending && <Spinner className="h-4 w-4" />}
        {createTask.isPending ? 'Creating…' : 'Create task'}
      </button>
    </form>
  );
}
