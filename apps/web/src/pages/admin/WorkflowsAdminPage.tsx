import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
import { NeuSelect } from '../../components/NeuSelect';

const CATEGORIES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

/**
 * Workflow builder: statuses + transition matrix (docs/06-FRONTEND-WEB.md §6) — the most
 * complex admin screen, since it directly shapes what every department's Kanban/list looks like.
 */
export function WorkflowsAdminPage() {
  const { data: workflows } = useWorkflowsAdmin();
  const [workflowId, setWorkflowId] = useState<string>('');
  const createWorkflow = useCreateWorkflow();

  useEffect(() => {
    if (!workflowId && workflows && workflows.length > 0) {
      const def = workflows.find((w) => w.is_default) ?? workflows[0];
      if (def) setWorkflowId(def.id);
    }
  }, [workflows, workflowId]);

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

  const [newWorkflowModalOpen, setNewWorkflowModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  async function handleCreateWorkflowSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    const wf = await createWorkflow.mutateAsync({ name: newWorkflowName.trim() });
    setWorkflowId((wf as { id: string }).id);
    setNewWorkflowName('');
    setNewWorkflowModalOpen(false);
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

  const orphanStatuses = statuses?.filter((s) => {
    if (!statuses || statuses.length <= 1) return false;
    const hasIncoming = transitions?.some((t) => t.to_status_id === s.id);
    const hasOutgoing = transitions?.some((t) => t.from_status_id === s.id);
    return !hasIncoming && !hasOutgoing;
  }) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <NeuSelect
          value={workflowId}
          onChange={setWorkflowId}
          options={(workflows ?? []).map((w) => ({ value: w.id, label: `${w.name}${w.is_default ? ' (default)' : ''}` }))}
          placeholder="Select workflow…"
          style={{ minWidth: '200px' }}
        />
        <button type="button" onClick={() => setNewWorkflowModalOpen(true)} className="btn-neu">
          + New workflow
        </button>
      </div>

      {workflowId && (
        <>
          {orphanStatuses.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-neu-sm p-4 text-sm text-slate-900 dark:text-slate-100">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Orphan Statuses Detected</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  The following statuses have no incoming or outgoing transitions:{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{orphanStatuses.map((s) => s.label).join(', ')}</span>.
                  Tasks will not be able to transition into or out of these statuses until transitions are configured.
                </p>
              </div>
            </div>
          )}

          <div className="neu-card !p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Statuses</h2>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {statuses?.map((s) => {
                const isOrphan = orphanStatuses.some((o) => o.id === s.id);
                return editingStatusId === s.id ? (
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
                      title={isOrphan ? 'Orphan status — click to rename' : 'Click to rename'}
                      className="inline-flex items-center gap-1"
                    >
                      <Badge label={s.label} color={s.color} />
                      {isOrphan && (
                        <span title="Orphan status (no transitions connected)">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </button>
                    <button onClick={() => removeStatus.mutate(s.id)} className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Delete status">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddStatus} className="flex flex-wrap gap-2">
              <input value={statusKey} onChange={(e) => setStatusKey(e.target.value)} placeholder="key" className="w-28 neu-input" />
              <input value={statusLabel} onChange={(e) => setStatusLabel(e.target.value)} placeholder="Label" className="w-36 neu-input" />
              <NeuSelect
                value={statusCategory}
                onChange={(v) => setStatusCategory(v as typeof statusCategory)}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                compact
                style={{ minWidth: '130px' }}
              />
              <button type="submit" className="btn-primary !py-1">
                Add status
              </button>
            </form>
          </div>

          <div className="neu-card !p-4">
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
              <NeuSelect
                value={fromStatus}
                onChange={setFromStatus}
                options={[{ value: '', label: 'From…' }, ...(statuses ?? []).map((s) => ({ value: s.id, label: s.label }))]}
                compact
                style={{ minWidth: '140px' }}
              />
              <NeuSelect
                value={toStatus}
                onChange={setToStatus}
                options={[{ value: '', label: 'To…' }, ...(statuses ?? []).map((s) => ({ value: s.id, label: s.label }))]}
                compact
                style={{ minWidth: '140px' }}
              />
              <input
                value={requiredPermission}
                onChange={(e) => setRequiredPermission(e.target.value)}
                placeholder="required permission (optional)"
                className="w-56 neu-input"
              />
              <button type="submit" className="btn-primary !py-1">
                Add transition
              </button>
            </form>
          </div>
        </>
      )}

      {newWorkflowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm neu-card shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create Workflow</h3>
              <button
                type="button"
                onClick={() => setNewWorkflowModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkflowSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="Workflow name (e.g. Content Production)"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewWorkflowModalOpen(false)}
                  className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWorkflow.isPending || !newWorkflowName.trim()}
                  className="btn-primary !text-xs"
                >
                  {createWorkflow.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
