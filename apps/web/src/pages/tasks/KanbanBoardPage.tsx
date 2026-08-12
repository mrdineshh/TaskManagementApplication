import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments, useTasks, useWorkflowStatuses, useWorkflows } from '../../features/tasks/hooks';
import { apiClient } from '../../lib/api-client/client';
import { Badge } from '../../components/Badge';

/**
 * Kanban board — columns = the task's WorkflowDefinition statuses in display_order; drag-and-drop
 * triggers the same /tasks/:id/transition endpoint as list view, so permission gates on
 * transitions (and the v1.1 approval/dependency-warning behavior) apply identically here
 * (docs/05-FEATURES.md §2.3).
 */
export function KanbanBoardPage() {
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  // Uses the org-wide default workflow's statuses as columns. A department running its own
  // WorkflowDefinition (02-DATA-MODEL.md §2.5a allows this) would need its columns resolved
  // from that department's workflow instead — not built out since the seeded data only has
  // one org-wide default workflow; flagged as a follow-up once a department-specific one exists.
  const { data: workflows } = useWorkflows();
  const defaultWorkflow = workflows?.find((w) => w.is_default);
  const { data: statuses } = useWorkflowStatuses(defaultWorkflow?.id);
  const { data, refetch } = useTasks({ department_id: departmentId || undefined });
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const sortedStatuses = [...(statuses ?? [])].sort((a: any, b: any) => a.display_order - b.display_order);
  const tasksByStatus = new Map<string, any[]>();
  for (const t of data?.items ?? []) {
    const list = tasksByStatus.get((t as any).status_id) ?? [];
    list.push(t);
    tasksByStatus.set((t as any).status_id, list);
  }

  // Task id travels on the native DataTransfer object, not React state — state set in
  // onDragStart isn't guaranteed to have re-rendered (and so be visible to onDrop's closure)
  // by the time drop fires, so relying on it is a race condition waiting to happen. This is
  // the standard, timing-independent way to carry data through an HTML5 drag gesture.
  async function handleDrop(toStatusId: string, taskId: string) {
    if (!taskId) return;
    try {
      const result = await apiClient.tasks.transition(taskId, toStatusId);
      if ('pending_approval' in result && result.pending_approval) {
        setMessage('This move requires approval — a pending approval request was created instead of changing status immediately.');
      } else if ('warnings' in result && result.warnings?.open_blockers?.length) {
        setMessage(`Moved, but this task still has open blockers: ${result.warnings.open_blockers.map((b) => b.task_title).join(', ')}`);
      } else {
        setMessage(null);
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
      refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not move task');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Kanban Board</h1>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStatuses.map((status: any) => (
          <div
            key={status.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(status.id, e.dataTransfer.getData('text/plain'))}
            className="w-64 shrink-0 rounded-lg bg-slate-100 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <Badge label={status.label} color={status.color} />
              <span className="text-xs text-slate-400">{tasksByStatus.get(status.id)?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(tasksByStatus.get(status.id) ?? []).map((t: any) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  className="cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                >
                  <Link to={`/tasks/${t.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                    {t.title}
                  </Link>
                  <div className="mt-2 flex items-center justify-between">
                    {t.priority && <Badge label={t.priority.label} color={t.priority.color} />}
                    {t.assignee && <span className="text-xs text-slate-400">{t.assignee.full_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
