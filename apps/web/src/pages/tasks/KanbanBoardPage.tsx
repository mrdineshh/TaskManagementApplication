import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments, useTasks, useWorkflowStatuses, useWorkflows } from '../../features/tasks/hooks';
import { apiClient } from '../../lib/api-client/client';
import { Badge } from '../../components/Badge';

type Swimlane = 'none' | 'assignee' | 'priority';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Assignee avatar — falls back to initials on a colored circle when there's no avatar_url. */
function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return <img src={url} alt={name} title={name} className="h-5 w-5 rounded-full object-cover" />;
  }
  return (
    <span
      title={name}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-[9px] font-semibold text-brand-700 dark:text-brand-300"
    >
      {initials(name)}
    </span>
  );
}

/** Due-date badge — red once past due, amber inside the next 2 days, muted otherwise. Only
 * flagged at all outside a "done"-category column, since a completed task's due date isn't a
 * live risk anymore. */
function DueBadge({ dueDate, isDone }: { dueDate: string | null; isDone: boolean }) {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const label = new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (isDone) return <span className="text-[11px] text-slate-400 dark:text-slate-500">{label}</span>;
  if (days < 0) return <span className="text-[11px] font-medium text-red-600 dark:text-red-400">Overdue · {label}</span>;
  if (days <= 2) return <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Due {label}</span>;
  return <span className="text-[11px] text-slate-400 dark:text-slate-500">{label}</span>;
}

function TaskCard({ task, isDoneColumn }: { task: any; isDoneColumn: boolean }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      className="cursor-grab rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm active:cursor-grabbing"
    >
      <Link to={`/tasks/${task.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-300">
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.priority && <Badge label={task.priority.label} color={task.priority.color} />}
        <DueBadge dueDate={task.due_date} isDone={isDoneColumn} />
        {task._count?.subtasks > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {task._count.subtasks}
          </span>
        )}
      </div>
      {task.assignee && (
        <div className="mt-2 flex items-center gap-1.5">
          <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} />
          <span className="truncate text-xs text-slate-400 dark:text-slate-500">{task.assignee.full_name}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Kanban board — columns = the task's WorkflowDefinition statuses in display_order; drag-and-drop
 * triggers the same /tasks/:id/transition endpoint as list view, so permission gates on
 * transitions (and the v1.1 approval/dependency-warning behavior) apply identically here
 * (docs/05-FEATURES.md §2.3). Swimlanes + richer cards (docs/10-OPEN-DECISIONS.md §M9) — user's
 * clarified scope for item #1: not a rebuild or a change of default view, just grouping and
 * more at-a-glance info on the existing board.
 */
export function KanbanBoardPage() {
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const [swimlane, setSwimlane] = useState<Swimlane>('none');
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

  function lanesFor(tasks: any[]): { key: string; label: string; tasks: any[] }[] {
    if (swimlane === 'none') return [{ key: 'all', label: '', tasks }];
    const groups = new Map<string, { label: string; tasks: any[] }>();
    for (const t of tasks) {
      const key = swimlane === 'assignee' ? (t.assignee?.id ?? 'unassigned') : (t.priority?.id ?? 'none');
      const label = swimlane === 'assignee' ? (t.assignee?.full_name ?? 'Unassigned') : (t.priority?.label ?? 'No priority');
      if (!groups.has(key)) groups.set(key, { label, tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    return [...groups.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kanban Board</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700 text-sm">
            {(['none', 'assignee', 'priority'] as Swimlane[]).map((s) => (
              <button
                key={s}
                onClick={() => setSwimlane(s)}
                className={`px-2.5 py-1.5 ${
                  swimlane === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {s === 'none' ? 'No grouping' : s === 'assignee' ? 'By assignee' : 'By priority'}
              </button>
            ))}
          </div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
          >
            <option value="">All departments</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{message}</div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStatuses.map((status: any) => {
          const columnTasks = tasksByStatus.get(status.id) ?? [];
          const lanes = lanesFor(columnTasks);
          return (
            <div
              key={status.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(status.id, e.dataTransfer.getData('text/plain'))}
              className="w-64 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <Badge label={status.label} color={status.color} />
                <span className="text-xs text-slate-400 dark:text-slate-500">{columnTasks.length}</span>
              </div>
              <div className="space-y-3">
                {lanes.map((lane) => (
                  <div key={lane.key}>
                    {swimlane !== 'none' && (
                      <p className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {lane.label} <span className="font-normal normal-case">({lane.tasks.length})</span>
                      </p>
                    )}
                    <div className="space-y-2">
                      {lane.tasks.map((t) => (
                        <TaskCard key={t.id} task={t} isDoneColumn={status.category === 'done'} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
