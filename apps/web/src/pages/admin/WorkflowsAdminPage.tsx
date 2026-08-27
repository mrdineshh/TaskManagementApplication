import { useState } from 'react';
import {
  useAddStatus,
  useAddTransition,
  useCreateWorkflow,
  useRemoveStatus,
  useRemoveTransition,
  useUpdateStatus,
  useWorkflowStatusesAdmin,
  useWorkflowTransitionsAdmin,
  useWorkflowsAdmin,
} from '../../features/admin/hooks';
import { Badge } from '../../components/Badge';

const CATEGORIES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

/**
 * Workflow builder: statuses + transition matrix (docs/06-FRONTEND-WEB.md §6) — the most
 * complex admin screen, since it directly shapes what every department's Kanban/list looks like.
 */
export function WorkflowsAdminPage() {
  const { data: workflows } = useWorkflowsAdmin();
  const [workflowId, setWorkflowId] = useState<string>('');
  const createWorkflow = useCreateWorkflow();

  const { data: statuses } = useWorkflowStatusesAdmin(workflowId || undefined);
  const { data: transitions } = useWorkflowTransitionsAdmin(workflowId || undefined);
  const addStatus = useAddStatus(workflowId);
  const updateStatus = useUpdateStatus(workflowId);
  const removeStatus = useRemoveStatus(workflowId);
  const addTransition = useAddTransition(workflowId);
  const removeTransition = useRemoveTransition(workflowId);

  const [statusKey, setStatusKey] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [statusCategory, setStatusCategory] = useState<(typeof CATEGORIES)[number]>('todo');
  const [fromStatus, setFromStatus] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [requiredPermission, setRequiredPermission] = useState('');
  const [editingStatusId, setEditingStatusId] = useState<string | undefined>(undefined);
  const [editStatusLabel, setEditStatusLabel] = useState('');

  async function saveStatusLabel(id: string) {
    if (!editStatusLabel.trim()) return;
    await updateStatus.mutateAsync({ id, data: { label: editStatusLabel } });
    setEditingStatusId(undefined);
  }

  async function handleNewWorkflow() {
    const name = prompt('Workflow name?');
    if (!name) return;
    const wf = await createWorkflow.mutateAsync({ name });
    setWorkflowId((wf as { id: string }).id);
  }

  async function handleAddStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!statusKey.trim() || !statusLabel.trim()) return;
    await addStatus.mutateAsync({ key: statusKey, label: statusLabel, category: statusCategory, display_order: statuses?.length ?? 0 });
    setStatusKey('');
    setStatusLabel('');
  }

  async function handleAddTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!fromStatus || !toStatus) return;
    await addTransition.mutateAsync({ from_status_id: fromStatus, to_status_id: toStatus, required_permission: requiredPermission || null });
    setRequiredPermission('');
  }

  const statusLabelOf = (id: string) => statuses?.find((s) => s.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm">
          <option value="">Select workflow…</option>
          {workflows?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} {w.is_default ? '(default)' : ''}
            </option>
          ))}
        </select>
        <button onClick={handleNewWorkflow} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-950">
          + New workflow
        </button>
      </div>

      {workflowId && (
        <>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Statuses</h2>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {statuses?.map((s) =>
                editingStatusId === s.id ? (
                  <div key={s.id} className="flex items-center gap-1">
                    <input
                      value={editStatusLabel}
                      onChange={(e) => setEditStatusLabel(e.target.value)}
                      autoFocus
                      className="w-28 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs"
                    />
                    <button onClick={() => saveStatusLabel(s.id)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditingStatusId(undefined)} className="text-xs text-slate-400 hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div key={s.id} className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingStatusId(s.id);
                        setEditStatusLabel(s.label);
                      }}
                      title="Click to rename"
                    >
                      <Badge label={s.label} color={s.color} />
                    </button>
                    <button onClick={() => removeStatus.mutate(s.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400">
                      ×
                    </button>
                  </div>
                ),
              )}
            </div>
            <form onSubmit={handleAddStatus} className="flex flex-wrap gap-2">
              <input value={statusKey} onChange={(e) => setStatusKey(e.target.value)} placeholder="key" className="w-28 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm" />
              <input value={statusLabel} onChange={(e) => setStatusLabel(e.target.value)} placeholder="Label" className="w-36 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm" />
              <select value={statusCategory} onChange={(e) => setStatusCategory(e.target.value as typeof statusCategory)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700">
                Add status
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Transitions</h2>
            <ul className="mb-3 space-y-1">
              {transitions?.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span>
                    {statusLabelOf(t.from_status_id)} → {statusLabelOf(t.to_status_id)}
                    {t.required_permission && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">requires {t.required_permission}</span>}
                  </span>
                  <button onClick={() => removeTransition.mutate(t.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddTransition} className="flex flex-wrap gap-2">
              <select value={fromStatus} onChange={(e) => setFromStatus(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm">
                <option value="">From…</option>
                {statuses?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm">
                <option value="">To…</option>
                {statuses?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                value={requiredPermission}
                onChange={(e) => setRequiredPermission(e.target.value)}
                placeholder="required permission (optional)"
                className="w-56 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
              />
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700">
                Add transition
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
