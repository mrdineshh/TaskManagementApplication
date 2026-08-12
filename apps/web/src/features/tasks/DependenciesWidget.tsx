import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddDependency, useRemoveDependency, useTaskDependencies, useTasks } from './hooks';

/**
 * Task dependencies (docs/02-DATA-MODEL.md §3). Blocking is a soft warning, not a hard
 * block, per docs/10-OPEN-DECISIONS.md B2 — the warning itself surfaces from the
 * /transition response (see TaskDetailPage), this widget is for managing the links.
 */
export function DependenciesWidget({ taskId, departmentId }: { taskId: string; departmentId: string }) {
  const { data: dependencies } = useTaskDependencies(taskId);
  const { data: candidateTasks } = useTasks({ department_id: departmentId });
  const addDependency = useAddDependency(taskId);
  const removeDependency = useRemoveDependency(taskId);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [type, setType] = useState<'blocks' | 'relates_to'>('blocks');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskId) return;
    await addDependency.mutateAsync({ dependsOnTaskId: selectedTaskId, type });
    setSelectedTaskId('');
  }

  const options = (candidateTasks?.items ?? []).filter((t: any) => t.id !== taskId);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Dependencies</h2>
      <ul className="mb-3 space-y-1">
        {dependencies?.map((d: any) => (
          <li key={d.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-500">{d.type}</span>
              <Link to={`/tasks/${d.depends_on_task.id}`} className="text-brand-700 hover:underline">
                {d.depends_on_task.title}
              </Link>
            </span>
            <button onClick={() => removeDependency.mutate(d.id)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </li>
        ))}
        {dependencies?.length === 0 && <li className="text-sm text-slate-400">No dependencies.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex gap-2">
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Depends on…</option>
          {options.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="blocks">blocks</option>
          <option value="relates_to">relates to</option>
        </select>
        <button
          type="submit"
          disabled={addDependency.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
