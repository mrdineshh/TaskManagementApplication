import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddDependency, useRemoveDependency, useTaskDependencies, useTasks } from './hooks';
import { NeuSelect } from '../../components/NeuSelect';
import { AlertTriangle, Link2 } from 'lucide-react';

/**
 * Task dependencies (docs/02-DATA-MODEL.md §3). Blocking is a soft warning, not a hard
 * block, per docs/10-OPEN-DECISIONS.md B2.
 */
export function DependenciesWidget({
  taskId,
  departmentId,
  canEdit = false,
}: {
  taskId: string;
  departmentId: string;
  canEdit?: boolean;
}) {
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

  const taskOptions = [
    { value: '', label: 'Depends on…' },
    ...options.map((t: any) => ({ value: t.id, label: t.title })),
  ];

  const typeOptions = [
    { value: 'blocks', label: 'blocks' },
    { value: 'relates_to', label: 'relates to' },
  ];

  // Check for open blockers (tasks this depends on that are not done)
  const openBlockers = (dependencies ?? []).filter((d: any) => {
    if (d.type !== 'blocks') return false;
    const targetTask = d.depends_on_task ?? d.dependsOnTask;
    if (!targetTask) return false;
    const status = targetTask.status;
    return !(status?.category === 'done' || status?.key === 'done');
  });

  return (
    <div className="neu-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Dependencies
          {dependencies?.length ? (
            <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {dependencies.length}
            </span>
          ) : null}
        </h2>
        {openBlockers.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            {openBlockers.length} open blocker{openBlockers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <ul className="mb-3 space-y-1.5">
        {dependencies?.map((d: any) => {
          const targetTask = d.depends_on_task ?? d.dependsOnTask;
          if (!targetTask) return null;
          const isBlock = d.type === 'blocks';
          const targetStatus = targetTask.status;
          const isTargetDone = targetStatus?.category === 'done' || targetStatus?.key === 'done';
          const isOpenBlocker = isBlock && !isTargetDone;

          return (
            <li
              key={d.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-colors ${
                isOpenBlocker
                  ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Dependency type badge */}
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isBlock
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {isBlock ? '🔴 blocks' : '🔵 relates'}
                </span>

                {/* Target task link */}
                <Link
                  to={`/tasks/${targetTask.id}`}
                  className="font-medium hover:underline truncate"
                  style={{ color: '#2563EB' }}
                >
                  {targetTask.title}
                </Link>

                {/* Open blocker indicator */}
                {isOpenBlocker && (
                  <span title="This dependency is not yet done" className="shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Target task status pill */}
                {targetStatus && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: targetStatus.color ? `${targetStatus.color}20` : 'var(--neu-dark)',
                      color: targetStatus.color ?? 'var(--text-faint)',
                      border: `1px solid ${targetStatus.color ?? 'var(--neu-dark)'}50`,
                    }}
                  >
                    {targetStatus.label}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => removeDependency.mutate(d.id)}
                    disabled={removeDependency.isPending}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 hover:underline transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {dependencies?.length === 0 && (
          <li className="flex items-center gap-2 text-sm py-1" style={{ color: 'var(--text-faint)' }}>
            <Link2 className="h-3.5 w-3.5" />
            No dependencies set.
          </li>
        )}
      </ul>

      {canEdit && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-center border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex-1 min-w-[160px]">
            <NeuSelect
              value={selectedTaskId}
              onChange={setSelectedTaskId}
              options={taskOptions}
              placeholder="Depends on…"
              compact
              style={{ width: '100%' }}
            />
          </div>
          <div className="w-32">
            <NeuSelect
              value={type}
              onChange={(v) => setType(v as typeof type)}
              options={typeOptions}
              compact
              style={{ width: '100%' }}
            />
          </div>
          <button
            type="submit"
            disabled={addDependency.isPending || !selectedTaskId}
            className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
