import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddDependency, useRemoveDependency, useTaskDependencies, useTasks } from './hooks';
import { NeuSelect } from '../../components/NeuSelect';
import { AlertTriangle, Ban, Link2, Plus } from 'lucide-react';

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
      {/* Header matching Time Log standard */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-indigo-600 bg-white dark:bg-slate-900 text-indigo-600 shadow-neu-sm">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Dependencies
              </h2>
              {dependencies?.length ? (
                <span className="rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-600 px-2 py-0.2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs">
                  {dependencies.length}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Blockers &amp; related task chains</p>
          </div>
        </div>
        {openBlockers.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
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
                {/* Dependency type badge with SVG icons instead of emojis */}
                <span
                  className={`shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isBlock
                      ? 'bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                      : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {isBlock ? (
                    <>
                      <Ban className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                      <span>blocks</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>relates</span>
                    </>
                  )}
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
                    className="inline-flex items-center gap-1 rounded-md border-2 border-red-600 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 shadow-neu-sm transition-all disabled:opacity-50"
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
            <Link2 className="h-3.5 w-3.5 text-slate-400" />
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
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-indigo-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-neu-sm transition-all disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Dependency
          </button>
        </form>
      )}
    </div>
  );
}
