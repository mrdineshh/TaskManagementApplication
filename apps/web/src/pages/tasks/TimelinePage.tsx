import { useMemo, useState, useRef, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Filter,
  Link2,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  RotateCcw,
  Navigation,
  Clock,
  Table2,
  BarChart3,
  TrendingUp,
  Users,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { useDepartments, useTasks, useTimesheetRows, useUsers } from '../../features/tasks/hooks';
import { apiClient } from '../../lib/api-client/client';
import { EmptyState } from '../../components/EmptyState';
import { NeuSelect } from '../../components/NeuSelect';
import { useSessionStore } from '../../lib/auth/session-store';
import { usePermission } from '../../lib/permissions/usePermission';

/* ─── Types ────────────────────────────────────────────────────────────── */

interface TaskRow {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  created_at?: string;
  status?: { label: string; color: string | null; category: string };
  priority?: { label: string; color: string | null };
}

type TimelineFilter = 'all' | 'todo' | 'in_progress' | 'done' | 'overdue' | 'blocked';
type Tab = 'gantt' | 'timesheet';
type SortKey = 'title' | 'assignee' | 'department' | 'status' | 'due_date' | 'hours';
type SortDir = 'asc' | 'desc';

type DatePreset = 'week' | 'month' | 'last30' | 'quarter' | 'all';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAY_WIDTH = 52;
const ROW_HEIGHT = 48;
const CATEGORY_COLOR: Record<string, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  done: '#10b981',
  cancelled: '#94a3b8',
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEffectiveDates(t: TaskRow): { start: Date; due: Date } {
  const due = t.due_date ? new Date(t.due_date) : null;
  let start = t.start_date ? new Date(t.start_date) : null;
  if (!start && due) {
    if (t.created_at) {
      start = new Date(t.created_at);
      if (start.getTime() > due.getTime()) start = due;
    } else {
      start = new Date(due.getTime() - 2 * DAY_MS);
    }
  }
  if (start && !due) return { start, due: new Date(start.getTime() + 2 * DAY_MS) };
  if (start && due && start.getTime() > due.getTime()) start = due;
  return { start: start ?? new Date(), due: due ?? new Date() };
}

function fmt(mins: number): string {
  if (mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(d: string | null | Date | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function presetRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  const from = new Date(
    preset === 'week'
      ? now.getTime() - 7 * DAY_MS
      : preset === 'month' || preset === 'last30'
        ? now.getTime() - 30 * DAY_MS
        : now.getTime() - 90 * DAY_MS,
  )
    .toISOString()
    .split('T')[0];
  return { from, to };
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function statusBadgeStyle(category: string): string {
  const map: Record<string, string> = {
    todo: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-slate-400',
    in_progress: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-blue-600',
    done: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-emerald-600',
    cancelled: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-slate-400',
  };
  return map[category] ?? map.todo;
}



/* ─── Main Component ─────────────────────────────────────────────────────── */

export function TimelinePage() {
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('gantt');
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = useSessionStore((s) => s.currentUser);
  const canDelete = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const isManagerOrAdmin = canDelete || canManageUsers || currentUser?.roles?.some((r: any) => r.name === 'Admin' || r.name === 'Manager');

  // Gantt data
  const { data, isLoading: ganttLoading, refetch } = useTasks({ department_id: departmentId || undefined, limit: '200' });

  // Timesheet data
  const tsRange = presetRange(datePreset);
  const { data: timesheetData, isLoading: tsLoading } = useTimesheetRows({
    department_id: departmentId || undefined,
    from: tsRange?.from,
    to: tsRange?.to,
    user_id: assigneeFilter || undefined,
  });

  // Members for assignee filter (manager only)
  const { data: members } = useUsers(isManagerOrAdmin ? departmentId || undefined : undefined);

  const allTasks = useMemo(() => (Array.isArray(data) ? data : (data?.items ?? [])) as unknown as TaskRow[], [data]);
  const dated = useMemo(() => allTasks.filter((t) => t.start_date || t.due_date), [allTasks]);
  const undatedCount = allTasks.length - dated.length;

  const sorted = useMemo(
    () =>
      [...dated].sort((a, b) => {
        const aDates = getEffectiveDates(a);
        const bDates = getEffectiveDates(b);
        return aDates.start.getTime() - bDates.start.getTime();
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

  const blockerTitlesByTask = useMemo(() => {
    const map = new Map<string, { title: string; open: boolean }[]>();
    sorted.forEach((task, i) => {
      const deps = dependencyQueries[i]?.data;
      if (!deps) return;
      for (const dep of deps) {
        if (dep.type !== 'blocks') continue;
        const blocker = sorted.find((t) => t.id === dep.depends_on_task_id);
        const blockerOpen = blocker ? blocker.status?.category !== 'done' : true;
        const list = map.get(task.id) ?? [];
        list.push({ title: dep.depends_on_task?.title ?? 'Dependent Task', open: blockerOpen });
        map.set(task.id, list);
      }
    });
    return map;
  }, [sorted, dependencyQueries]);

  const counts = useMemo(() => {
    const now = Date.now();
    let todo = 0, inProgress = 0, done = 0, overdue = 0, blocked = 0;
    for (const t of sorted) {
      const cat = t.status?.category ?? 'todo';
      if (cat === 'todo') todo++;
      else if (cat === 'in_progress') inProgress++;
      else if (cat === 'done') done++;
      const isDone = cat === 'done';
      if (!isDone && t.due_date && new Date(t.due_date).getTime() < now) overdue++;
      const blockers = blockerTitlesByTask.get(t.id) ?? [];
      if (blockers.some((b) => b.open)) blocked++;
    }
    return { all: sorted.length, todo, inProgress, done, overdue, blocked };
  }, [sorted, blockerTitlesByTask]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    return sorted.filter((t) => {
      if (activeFilter === 'all') return true;
      const cat = t.status?.category ?? 'todo';
      const isDone = cat === 'done';
      if (activeFilter === 'todo') return cat === 'todo';
      if (activeFilter === 'in_progress') return cat === 'in_progress';
      if (activeFilter === 'done') return cat === 'done';
      if (activeFilter === 'overdue') return !isDone && t.due_date && new Date(t.due_date).getTime() < now;
      if (activeFilter === 'blocked') {
        const blockers = blockerTitlesByTask.get(t.id) ?? [];
        return blockers.some((b) => b.open);
      }
      return true;
    });
  }, [sorted, activeFilter, blockerTitlesByTask]);

  // Timesheet sort
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(key); setSortDir('asc'); }
    },
    [sortKey],
  );

  const sortedTimesheet = useMemo(() => {
    if (!timesheetData) return [];
    return [...timesheetData].sort((a, b) => {
      let av: unknown, bv: unknown;
      if (sortKey === 'title') { av = a.title; bv = b.title; }
      else if (sortKey === 'assignee') { av = a.assignee_name ?? ''; bv = b.assignee_name ?? ''; }
      else if (sortKey === 'department') { av = a.department_name ?? ''; bv = b.department_name ?? ''; }
      else if (sortKey === 'status') { av = a.status?.label ?? ''; bv = b.status?.label ?? ''; }
      else if (sortKey === 'due_date') { av = a.due_date ?? ''; bv = b.due_date ?? ''; }
      else { av = a.total_logged_minutes; bv = b.total_logged_minutes; }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [timesheetData, sortKey, sortDir]);

  // KPI stats for timesheet
  const kpi = useMemo(() => {
    if (!timesheetData?.length) return { totalHours: 0, trackedTasks: 0, avgHours: 0, overdue: 0 };
    const now = Date.now();
    const totalMins = timesheetData.reduce((s, r) => s + r.total_logged_minutes, 0);
    const trackedTasks = timesheetData.filter((r) => r.total_logged_minutes > 0).length;
    const overdue = timesheetData.filter(
      (r) => r.status?.category !== 'done' && r.due_date && new Date(r.due_date).getTime() < now,
    ).length;
    return {
      totalHours: totalMins / 60,
      trackedTasks,
      avgHours: trackedTasks > 0 ? totalMins / 60 / trackedTasks : 0,
      overdue,
    };
  }, [timesheetData]);

  const deptName = departments?.find((d: any) => d.id === departmentId)?.name ?? '';

  /* ── Gantt rendering ── */

  if (ganttLoading && activeTab === 'gantt') {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500 animate-pulse">Loading timeline...</p>
      </div>
    );
  }

  const today = startOfDay(new Date());

  let ganttContent: React.ReactNode = null;

  if (activeTab === 'gantt') {
    if (sorted.length === 0) {
      ganttContent = (
        <div className="mt-6 neu-card p-8 shadow-sm rounded-2xl">
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            title="No Scheduled Tasks Found"
            subtitle="Tasks with start or due dates will appear on this interactive Gantt schedule."
          />
        </div>
      );
    } else {
      const dates = filteredTasks.flatMap((t) => {
        const eff = getEffectiveDates(t);
        return [eff.start.getTime(), eff.due.getTime()];
      });
      const minTaskDate = dates.length > 0 ? Math.min(...dates, today.getTime()) : today.getTime();
      const maxTaskDate = dates.length > 0 ? Math.max(...dates, today.getTime()) : today.getTime();
      const rangeStart = startOfDay(new Date(minTaskDate - 3 * DAY_MS));
      const rangeEnd = startOfDay(new Date(maxTaskDate + 4 * DAY_MS));
      const totalDays = Math.max(10, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS));
      const dayWidth = MIN_DAY_WIDTH;
      const chartWidth = Math.max(900, totalDays * dayWidth);

      const xForDate = (isoOrDate: string | Date) => {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        const diff = Math.round((startOfDay(d).getTime() - rangeStart.getTime()) / DAY_MS);
        return Math.max(0, diff * dayWidth);
      };

      const todayX =
        today >= rangeStart && today <= rangeEnd
          ? Math.round((today.getTime() - rangeStart.getTime()) / DAY_MS) * dayWidth
          : null;

      const handleScrollToToday = () => {
        if (scrollContainerRef.current && todayX !== null) {
          scrollContainerRef.current.scrollTo({ left: Math.max(0, todayX - 250), behavior: 'smooth' });
        }
      };

      const positions = new Map(filteredTasks.map((t, i) => [t.id, { index: i, y: i * ROW_HEIGHT + ROW_HEIGHT / 2 }]));

      // Build month groups for header
      const monthGroups: { label: string; x: number; width: number }[] = [];
      let curMonth = -1, curStart = 0;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(rangeStart.getTime() + i * DAY_MS);
        if (d.getMonth() !== curMonth) {
          if (curMonth !== -1) monthGroups.push({ label: new Date(rangeStart.getTime() + curStart * DAY_MS).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), x: curStart * dayWidth, width: (i - curStart) * dayWidth });
          curMonth = d.getMonth();
          curStart = i;
        }
      }
      monthGroups.push({ label: new Date(rangeStart.getTime() + curStart * DAY_MS).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), x: curStart * dayWidth, width: (totalDays - curStart) * dayWidth });

      const days: { date: Date; x: number; isWeekend: boolean; isToday: boolean }[] = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(rangeStart.getTime() + i * DAY_MS);
        const dayOfWeek = d.getDay();
        days.push({ date: d, x: i * dayWidth, isWeekend: dayOfWeek === 0 || dayOfWeek === 6, isToday: d.getTime() === today.getTime() });
      }

      const connectors: { x1: number; y1: number; x2: number; y2: number; open: boolean }[] = [];
      filteredTasks.forEach((task, i) => {
        const originalIndex = sorted.findIndex((t) => t.id === task.id);
        const deps = dependencyQueries[originalIndex]?.data;
        if (!deps) return;
        for (const dep of deps) {
          if (dep.type !== 'blocks') continue;
          const blocker = filteredTasks.find((t) => t.id === dep.depends_on_task_id);
          const blockerOpen = blocker ? blocker.status?.category !== 'done' : true;
          const blockerPos = positions.get(dep.depends_on_task_id);
          const blockedPos = positions.get(task.id);
          if (blocker && blockerPos && blockedPos) {
            connectors.push({
              x1: xForDate(blocker.due_date ?? blocker.start_date!) + dayWidth,
              y1: blockerPos.y,
              x2: xForDate(task.start_date ?? task.due_date!),
              y2: blockedPos.y,
              open: blockerOpen,
            });
          }
        }
      });

      ganttContent = (
        <>
          {/* Legend/filter strip */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs shadow-sm">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mr-2 px-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Status Filter:</span>
            </div>
            <FilterLegendButton label="All" count={counts.all} isActive={activeFilter === 'all'} onClick={() => setActiveFilter('all')} color="#475569" />
            <FilterLegendButton label="To Do" count={counts.todo} isActive={activeFilter === 'todo'} onClick={() => setActiveFilter('todo')} color={CATEGORY_COLOR.todo} />
            <FilterLegendButton label="In Progress" count={counts.inProgress} isActive={activeFilter === 'in_progress'} onClick={() => setActiveFilter('in_progress')} color={CATEGORY_COLOR.in_progress} />
            <FilterLegendButton label="Completed" count={counts.done} isActive={activeFilter === 'done'} onClick={() => setActiveFilter('done')} color={CATEGORY_COLOR.done} />
            <FilterLegendButton label="Overdue" count={counts.overdue} isActive={activeFilter === 'overdue'} onClick={() => setActiveFilter('overdue')} color="#dc2626" />
            <FilterLegendButton label="Blocked" count={counts.blocked} isActive={activeFilter === 'blocked'} onClick={() => setActiveFilter('blocked')} color="#f59e0b" icon={<Link2 className="w-3 h-3 text-amber-500" />} />
            <div className="ml-auto hidden sm:flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 border-l-2 border-dashed border-indigo-600 dark:border-indigo-400" />
                <span>Today</span>
              </div>
            </div>
            {todayX !== null && (
              <button
                onClick={handleScrollToToday}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                Jump to Today
              </button>
            )}
          </div>

          {undatedCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{undatedCount} task(s) without start or due dates are omitted from the Gantt schedule.</span>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="neu-card p-8 shadow-sm rounded-2xl">
              <EmptyState
                icon={<Filter className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
                title="No Tasks Match Filter"
                subtitle={`No tasks found matching "${activeFilter.replace('_', ' ')}". Click "All" to reset.`}
              />
            </div>
          ) : (
            <div className="flex neu-card !p-0 overflow-hidden shadow-md rounded-2xl">
              {/* Left frozen column */}
              <div className="w-72 shrink-0 border-r border-[var(--neu-dark)] bg-[var(--neu-bg)] z-10">
                {/* Two-row header to match chart */}
                <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80" style={{ height: 68 }}>
                  <div className="flex items-end px-4 pb-2 h-full">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Task Name ({filteredTasks.length})
                    </span>
                  </div>
                </div>
                {filteredTasks.map((t) => {
                  const isDone = t.status?.category === 'done';
                  const isOverdue = !isDone && t.due_date && new Date(t.due_date).getTime() < Date.now();
                  const blockers = blockerTitlesByTask.get(t.id) ?? [];
                  const hasOpenBlocker = blockers.some((b) => b.open);
                  const isSelfAssigned = (t as any).assignee_id === currentUser?.id || (t as any).assignee?.id === currentUser?.id;
                  const canOpenTask = isManagerOrAdmin || isSelfAssigned;

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: t.priority?.color ?? '#94a3b8' }}
                          title={`Priority: ${t.priority?.label ?? 'Normal'}`}
                        />
                        {canOpenTask ? (
                          <Link
                            to={`/tasks/${t.id}`}
                            className={`break-words leading-snug text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400 transition-colors ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}
                            title={t.title}
                          >
                            {t.title}
                          </Link>
                        ) : (
                          <span className={`break-words leading-snug text-sm font-medium cursor-default select-none ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {t.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasOpenBlocker && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 dark:text-slate-100 shadow-2xs" title={`Blocked by: ${blockers.map((b) => b.title).join(', ')}`}>
                            <Link2 className="w-3 h-3 text-amber-500" />Blocked
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center rounded-full bg-white dark:bg-slate-900 border-2 border-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 dark:text-slate-100 shadow-2xs">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right scrollable chart */}
              <div className="flex-1 overflow-x-auto" ref={scrollContainerRef}>
                <div style={{ width: chartWidth, minWidth: '100%', position: 'relative' }}>
                  {/* Month group header */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 h-8 select-none">
                    {monthGroups.map((mg, i) => (
                      <div
                        key={i}
                        className="absolute flex items-center px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 overflow-hidden"
                        style={{ left: mg.x, width: mg.width, height: 32 }}
                      >
                        {mg.label}
                      </div>
                    ))}
                  </div>

                  {/* Day header */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 h-9 select-none">
                    {days.map((d, i) => (
                      <div
                        key={i}
                        className={`flex flex-col items-center justify-center border-r border-slate-200/60 dark:border-slate-800/60 text-[11px] shrink-0 ${
                          d.isToday
                            ? 'bg-brand-50/80 dark:bg-brand-950/50 font-bold text-brand-700 dark:text-brand-300'
                            : d.isWeekend
                              ? 'bg-slate-100/50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                        style={{ width: dayWidth }}
                      >
                        <span className="text-[9px] uppercase leading-none">{d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                        <span className="font-medium">{d.date.getDate()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Weekend/today column backgrounds */}
                  <div className="absolute inset-0 top-[68px] pointer-events-none flex">
                    {days.map((d, i) => (
                      <div
                        key={i}
                        className={`border-r border-slate-100 dark:border-slate-800/40 shrink-0 h-full ${
                          d.isToday
                            ? 'bg-brand-50/20 dark:bg-brand-950/20'
                            : d.isWeekend
                              ? 'bg-slate-50/50 dark:bg-slate-950/30'
                              : ''
                        }`}
                        style={{ width: dayWidth }}
                      />
                    ))}
                  </div>

                  {/* SVG: today line + connectors */}
                  <svg
                    width={chartWidth}
                    height={filteredTasks.length * ROW_HEIGHT}
                    className="absolute pointer-events-none"
                    style={{ top: 68, left: 0 }}
                  >
                    {todayX !== null && (
                      <line
                        x1={todayX + dayWidth / 2} y1={0}
                        x2={todayX + dayWidth / 2} y2={filteredTasks.length * ROW_HEIGHT}
                        stroke="#4f46e5" strokeWidth={2} strokeDasharray="4,4" opacity={0.8}
                      />
                    )}
                    {connectors.map((c, i) => (
                      <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                        stroke={c.open ? '#f59e0b' : '#94a3b8'} strokeWidth={1.5}
                        strokeDasharray={c.open ? undefined : '3,3'} markerEnd="url(#arrow)" />
                    ))}
                    <defs>
                      <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 z" fill="#64748b" />
                      </marker>
                    </defs>
                  </svg>

                  {/* Task bars */}
                  {filteredTasks.map((t) => {
                    const eff = getEffectiveDates(t);
                    const startX = xForDate(eff.start);
                    const endX = xForDate(eff.due) + dayWidth;
                    const barWidth = Math.max(140, endX - startX);
                    const isDone = t.status?.category === 'done';
                    const isOverdue = !isDone && t.due_date && new Date(t.due_date).getTime() < Date.now();
                    const baseColor = t.status?.color ?? CATEGORY_COLOR[t.status?.category ?? 'todo'] ?? '#2563EB';
                    const barColor = isOverdue ? '#dc2626' : baseColor;
                    const isSelfAssigned = (t as any).assignee_id === currentUser?.id || (t as any).assignee?.id === currentUser?.id;
                    const canOpenTask = isManagerOrAdmin || isSelfAssigned;
                    const assigneeName = (t as any).assignee?.fullName ?? (t as any).assignee?.full_name ?? null;

                    const barStyle = {
                      left: startX + 2,
                      width: barWidth - 4,
                      borderColor: barColor,
                      height: 32,
                      opacity: isDone ? 0.85 : 1,
                    };

                    const barClass = `absolute top-1/2 -translate-y-1/2 rounded-xl px-2.5 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 shadow-neu-sm flex items-center justify-between gap-1.5 z-10 transition-all overflow-hidden ${
                      canOpenTask ? 'hover:shadow-md hover:scale-[1.01] cursor-pointer' : 'cursor-default select-none'
                    } ${isOverdue ? 'ring-2 ring-red-400/30' : ''}`;

                    const barTitle = `${t.title} (${t.status?.label ?? 'Todo'}${isOverdue ? ' · OVERDUE' : ''}) — ${eff.start.toLocaleDateString()} → ${eff.due.toLocaleDateString()}${assigneeName ? ` · ${assigneeName}` : ''}`;
                    const isWideBar = barWidth >= 130;

                    const barContent = (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {assigneeName ? (
                            <>
                              <span
                                className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[9px] font-bold text-slate-800 dark:text-slate-200 shrink-0 leading-none"
                                title={`Assignee: ${assigneeName}`}
                              >
                                {initialsOf(assigneeName)}
                              </span>
                              {isWideBar && (
                                <span className="truncate whitespace-nowrap text-xs font-semibold text-slate-900 dark:text-slate-100 leading-none" title={assigneeName}>
                                  {assigneeName}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate leading-none">
                              {isWideBar ? 'Unassigned' : '—'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 shrink-0 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              {isWideBar && <span>Done</span>}
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800">
                              <AlertCircle className="w-3 h-3 shrink-0 text-red-600" />
                              {isWideBar && <span>Late</span>}
                            </span>
                          ) : t.status?.category === 'in_progress' ? (
                            <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                              <CircleDot className="w-3 h-3 shrink-0 text-blue-600" />
                              {isWideBar && <span>Active</span>}
                            </span>
                          ) : (
                            <CircleDot className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={t.id}
                        className="relative border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors"
                        style={{ height: ROW_HEIGHT, width: chartWidth }}
                      >
                        {canOpenTask ? (
                          <Link to={`/tasks/${t.id}`} className={barClass} style={barStyle} title={barTitle}>
                            {barContent}
                          </Link>
                        ) : (
                          <div className={barClass} style={barStyle} title={`${barTitle} (Assigned to another employee)`}>
                            {barContent}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  /* ── Timesheet rendering ── */

  const tsContent = activeTab === 'timesheet' ? (
    <div className="space-y-4">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Clock className="w-4 h-4" />} label="Total Hours" value={kpi.totalHours.toFixed(1) + 'h'} color="blue" />
        <KpiCard icon={<BarChart3 className="w-4 h-4" />} label="Tasks Tracked" value={String(kpi.trackedTasks)} color="emerald" />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Avg per Task" value={kpi.avgHours.toFixed(1) + 'h'} color="violet" />
        <KpiCard icon={<AlertCircle className="w-4 h-4" />} label="Overdue" value={String(kpi.overdue)} color={kpi.overdue > 0 ? 'red' : 'slate'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 neu-card px-5 py-3.5 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
        </div>
        {(['week', 'month', 'last30', 'quarter', 'all'] as DatePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setDatePreset(p)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              datePreset === p
                ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
            }`}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'last30' ? 'Last 30 Days' : p === 'quarter' ? 'Last 3 Months' : 'All Time'}
          </button>
        ))}
        {isManagerOrAdmin && (members as any[])?.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Users className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <NeuSelect
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={[
                { value: "", label: "All Members" },
                ...((members as any[]) ?? []).map((m: any) => ({
                  value: m.id,
                  label: m.full_name ?? m.fullName ?? m.email,
                })),
              ]}
              placeholder="All Members"
              compact
              style={{ minWidth: "140px" }}
            />
          </div>
        )}
      </div>

      {/* Table */}
      {tsLoading ? (
        <div className="flex h-48 items-center justify-center neu-card p-8 rounded-2xl">
          <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">Loading timesheet…</p>
        </div>
      ) : sortedTimesheet.length === 0 ? (
        <div className="neu-card p-8 shadow-sm rounded-2xl">
          <EmptyState
            icon={<Table2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            title="No Timesheet Data"
            subtitle="No tasks found for the selected filters. Try a broader date range or department."
          />
        </div>
      ) : (
        <div className="neu-card !p-0 overflow-hidden shadow-md rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60">
                  <SortTh label="Task" sortKey="title" current={sortKey} dir={sortDir} onSort={handleSort} className="w-72 pl-5" />
                  {isManagerOrAdmin && (
                    <SortTh label="Assignee" sortKey="assignee" current={sortKey} dir={sortDir} onSort={handleSort} />
                  )}
                  <SortTh label="Department" sortKey="department" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Start" sortKey="due_date" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Due Date" sortKey="due_date" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Hours Logged" sortKey="hours" current={sortKey} dir={sortDir} onSort={handleSort} className="pr-5 text-right" />
                </tr>
              </thead>
              <tbody className="">
                {sortedTimesheet.map((row) => {
                  const isOverdue = row.status?.category !== 'done' && row.due_date && new Date(row.due_date).getTime() < Date.now();
                  const hours = row.total_logged_minutes / 60;
                  const isSelf = row.assignee_id === currentUser?.id;
                  const canOpen = isManagerOrAdmin || isSelf;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="pl-5 pr-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {row.priority?.color && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.priority.color }} title={row.priority?.label ?? ''} />
                          )}
                          {canOpen ? (
                            <Link to={`/tasks/${row.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 break-words leading-snug transition-colors">
                              {row.title}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-800 dark:text-slate-200 break-words leading-snug">{row.title}</span>
                          )}
                        </div>
                      </td>
                      {isManagerOrAdmin && (
                        <td className="px-3 py-3.5">
                          {row.assignee_name ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold shrink-0">
                                {initialsOf(row.assignee_name)}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300 text-xs break-words leading-snug">{row.assignee_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">Unassigned</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3.5 text-xs text-slate-500 dark:text-slate-400 break-words leading-snug">
                        {row.department_name ?? '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        {row.status ? (
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${statusBadgeStyle(row.status.category)}`}>
                            {row.status.label}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(row.start_date)}
                      </td>
                      <td className="px-3 py-3.5 text-xs whitespace-nowrap">
                        <span className={isOverdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}>
                          {fmtDate(row.due_date)}
                          {isOverdue && <span className="ml-1 text-[10px] rounded bg-red-100 dark:bg-red-950/60 px-1 py-0.5 text-red-600 dark:text-red-400">overdue</span>}
                        </span>
                      </td>
                      <td className="pl-3 pr-5 py-3.5 text-right">
                        <span className={`inline-flex items-center justify-end gap-1.5 font-bold tabular-nums ${
                          row.total_logged_minutes === 0
                            ? 'text-slate-300 dark:text-slate-600'
                            : hours >= 8
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {row.total_logged_minutes === 0 ? (
                            <span className="font-normal text-xs text-slate-400 dark:text-slate-600">No time logged</span>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 opacity-70" />
                              {fmt(row.total_logged_minutes)}
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer summary */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60">
                  <td colSpan={isManagerOrAdmin ? 6 : 5} className="pl-5 pr-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {sortedTimesheet.length} tasks · {kpi.trackedTasks} with logged time
                  </td>
                  <td className="pl-3 pr-5 py-3 text-right text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {fmt(sortedTimesheet.reduce((s, r) => s + r.total_logged_minutes, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <TimelineHeader
        departments={departments}
        departmentId={departmentId}
        onChange={setDepartmentId}
        onRefresh={() => refetch()}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === 'gantt' ? ganttContent : tsContent}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function TimelineHeader({
  departments,
  departmentId,
  onChange,
  onRefresh,
  activeTab,
  onTabChange,
}: {
  departments?: { id: string; name: string }[];
  departmentId: string;
  onChange: (id: string) => void;
  onRefresh?: () => void;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            Timeline &amp; Timesheet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gantt schedule with deadlines &amp; dependency chains · Timesheet (Tasks) with downloadable CSV
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Refresh
            </button>
          )}
          <NeuSelect
            value={departmentId}
            onChange={onChange}
            options={[
              { value: "", label: "All Departments" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            placeholder="All Departments"
            compact
            style={{ minWidth: "140px" }}
          />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1 w-fit">
        <TabBtn icon={<BarChart3 className="w-3.5 h-3.5" />} label="Gantt" isActive={activeTab === 'gantt'} onClick={() => onTabChange('gantt')} />
        <TabBtn icon={<Table2 className="w-3.5 h-3.5" />} label="Timesheet (Tasks)" isActive={activeTab === 'timesheet'} onClick={() => onTabChange('timesheet')} />
      </div>
    </div>
  );
}

function TabBtn({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
        isActive
          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterLegendButton({ label, count, isActive, onClick, color, icon }: {
  label: string; count: number; isActive: boolean; onClick: () => void; color: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
        isActive
          ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 shadow-2xs'
          : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
      }`}
    >
      {icon ? icon : <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
        {count}
      </span>
    </button>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    slate: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  };
  const cls = colorMap[color] ?? colorMap.slate;
  return (
    <div className="neu-card p-4 sm:p-5 shadow-sm flex items-center gap-3.5 rounded-2xl">
      <div className={`rounded-xl p-2.5 shrink-0 ${cls}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-black tabular-nums text-slate-900 dark:text-slate-100 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort, className = '' }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const isActive = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </th>
  );
}
