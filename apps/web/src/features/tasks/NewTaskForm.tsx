import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTask, useDepartments, usePriorities } from './hooks';

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { data: departments } = useDepartments();
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const { data: priorities } = usePriorities(departmentId || undefined);
  const createTask = useCreateTask();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !departmentId) return;
    const task = await createTask.mutateAsync({
      title,
      department_id: departmentId,
      priority_id: priorityId || undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    onDone();
    navigate(`/tasks/${(task as { id: string }).id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
        required
      />
      <div className="grid grid-cols-3 gap-3">
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
          required
        >
          <option value="">Department…</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={priorityId}
          onChange={(e) => setPriorityId(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
        >
          <option value="">Priority (default)</option>
          {priorities?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
        />
      </div>
      {createTask.isError && <p className="text-sm text-red-600 dark:text-red-400">{(createTask.error as Error).message}</p>}
      <button
        type="submit"
        disabled={createTask.isPending}
        className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {createTask.isPending ? 'Creating…' : 'Create task'}
      </button>
    </form>
  );
}
