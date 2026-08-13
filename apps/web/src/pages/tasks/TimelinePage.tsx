import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useDepartments, useTasks } from '../../features/tasks/hooks';
import { apiClient } from '../../lib/api-client/client';

interface TaskRow {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status?: { label: string; color: string | null; category: string };
  priority?: { label: string; color: string | null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;
const CATEGORY_COLOR: Record<string, string> = { todo: '#94a3b8', in_progress: '#2563eb', done: '#16a34a' };

/**
 * Gantt/timeline (docs/05-FEATURES.md §2.3) — bars scaled from start_date/due_date, plus
 * connector lines for open 'blocks' TaskDependency relationships between visible tasks.
 */
export function TimelinePage() {
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const { data, isLoading } = useTasks({ department_id: departmentId || undefined, limit: '200' });

  const allTasks = (data?.items ?? []) as unknown as TaskRow[];
  const dated = allTasks.filter((t) => t.start_date || t.due_date);
  const undatedCount = allTasks.length - dated.length;

  const sorted = useMemo(
    () =>
      [...dated].sort((a, b) => {
        const aStart = new Date(a.start_date ?? a.due_date!).getTime();
        const bStart = new Date(b.start_date ?? b.due_date!).getTime();
        return aStart - bStart;
      }),
    [dated],
  );

  const dependencyQueries = useQueries({
    queries: sorted.map((t) => ({
      queryKey: ['task-dependencies', t.id],
      queryFn: () => apiClient.tasks.dependencies(t.id),
      enabled: sorted.length > 0,
    })),
  });

  if (isLoading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>;

  if (sorted.length === 0) {
    return (
      <div>
        <TimelineHeader departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
        <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">
          No tasks with a start or due date in this scope yet. Set dates on a task to see it here.
        </p>
      </div>
    );
  }

  const dates = sorted.flatMap((t) => [t.start_date, t.due_date].filter(Boolean).map((d) => new Date(d as string).getTime()));
  const rangeStart = startOfDay(new Date(Math.min(...dates) - DAY_MS));
  const rangeEnd = startOfDay(new Date(Math.max(...dates) + DAY_MS));
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS));
  const chartWidth = totalDays * DAY_WIDTH;

  const xForDate = (iso: string) => Math.round((startOfDay(new Date(iso)).getTime() - rangeStart.getTime()) / DAY_MS) * DAY_WIDTH;

  const positions = new Map(sorted.map((t, i) => [t.id, { index: i, y: i * ROW_HEIGHT + ROW_HEIGHT / 2 }]));

  const dayLabels: { x: number; label: string }[] = [];
  for (let i = 0; i <= totalDays; i += Math.max(1, Math.ceil(totalDays / 30))) {
    const d = new Date(rangeStart.getTime() + i * DAY_MS);
    dayLabels.push({ x: i * DAY_WIDTH, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }

  const connectors: { x1: number; y1: number; x2: number; y2: number; open: boolean }[] = [];
  const blockerTitlesByTask = new Map<string, { title: string; open: boolean }[]>();

  sorted.forEach((task, i) => {
    const deps = dependencyQueries[i]?.data;
    if (!deps) return;
    for (const dep of deps) {
      if (dep.type !== 'blocks') continue;
      const blocker = sorted.find((t) => t.id === dep.depends_on_task_id);
      const blockerOpen = blocker ? blocker.status?.category !== 'done' : true;
      const list = blockerTitlesByTask.get(task.id) ?? [];
      list.push({ title: dep.depends_on_task.title, open: blockerOpen });
      blockerTitlesByTask.set(task.id, list);

      const blockerPos = positions.get(dep.depends_on_task_id);
      const blockedPos = positions.get(task.id);
      if (blocker && blockerPos && blockedPos) {
        const blockerEnd = xForDate(blocker.due_date ?? blocker.start_date!) + DAY_WIDTH;
        const blockedStart = xForDate(task.start_date ?? task.due_date!);
        connectors.push({ x1: blockerEnd, y1: blockerPos.y, x2: blockedStart, y2: blockedPos.y, open: blockerOpen });
      }
    }
  });

  return (
    <div>
      <TimelineHeader departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {undatedCount > 0 && (
        <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">{undatedCount} task(s) without a start or due date aren't shown.</p>
      )}

      <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400" style={{ height: 33 }}>
            Task
          </div>
          {sorted.map((t) => (
            <div key={t.id} className="flex items-center border-b border-slate-100 dark:border-slate-800 px-3 text-sm last:border-0" style={{ height: ROW_HEIGHT }}>
              <Link to={`/tasks/${t.id}`} className="truncate text-slate-700 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300" title={t.title}>
                {t.title}
              </Link>
              {(blockerTitlesByTask.get(t.id) ?? []).some((b) => b.open) && (
                <span
                  className="ml-1.5 shrink-0 text-amber-500 dark:text-amber-400"
                  title={`Blocked by: ${(blockerTitlesByTask.get(t.id) ?? []).map((b) => b.title).join(', ')}`}
                >
                  ⛓
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div style={{ width: chartWidth, position: 'relative' }}>
            <div className="relative border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950" style={{ height: 33 }}>
              {dayLabels.map((d) => (
                <span key={d.x} className="absolute top-2 text-xs text-slate-400 dark:text-slate-500" style={{ left: d.x + 4 }}>
                  {d.label}
                </span>
              ))}
            </div>

            <svg width={chartWidth} height={sorted.length * ROW_HEIGHT} className="absolute" style={{ top: 33, left: 0, pointerEvents: 'none' }}>
              {connectors.map((c, i) => (
                <line
                  key={i}
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  stroke={c.open ? '#f59e0b' : '#cbd5e1'}
                  strokeWidth={1.5}
                  strokeDasharray={c.open ? undefined : '3,3'}
                  markerEnd="url(#arrow)"
                />
              ))}
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>

            {sorted.map((t, i) => {
              const hasStart = Boolean(t.start_date);
              const hasEnd = Boolean(t.due_date);
              const startX = xForDate(t.start_date ?? t.due_date!);
              const endX = hasEnd ? xForDate(t.due_date!) + DAY_WIDTH : startX + DAY_WIDTH;
              const color = t.status?.color ?? CATEGORY_COLOR[t.status?.category ?? 'todo'] ?? '#94a3b8';
              return (
                <div
                  key={t.id}
                  className="relative border-b border-slate-100 dark:border-slate-800 last:border-0"
                  style={{ height: ROW_HEIGHT, width: chartWidth }}
                >
                  <Link
                    to={`/tasks/${t.id}`}
                    className="absolute top-1/2 -translate-y-1/2 rounded px-1.5 text-xs font-medium text-white shadow-sm"
                    style={{
                      left: startX,
                      width: Math.max(endX - startX, hasStart && hasEnd ? DAY_WIDTH : 16),
                      backgroundColor: color,
                      height: 18,
                      lineHeight: '18px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                    title={`${t.title}${t.priority ? ` · ${t.priority.label}` : ''}`}
                  >
                    {t.priority?.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <LegendDot color={CATEGORY_COLOR.todo} label="Todo" />
        <LegendDot color={CATEGORY_COLOR.in_progress} label="In progress" />
        <LegendDot color={CATEGORY_COLOR.done} label="Done" />
        <span className="flex items-center gap-1">
          <span className="text-amber-500 dark:text-amber-400">⛓</span> Open blocker
        </span>
      </div>
    </div>
  );
}

function TimelineHeader({
  departments,
  departmentId,
  onChange,
}: {
  departments?: { id: string; name: string }[];
  departmentId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Timeline</h1>
      <select
        value={departmentId}
        onChange={(e) => onChange(e.target.value)}
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
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
