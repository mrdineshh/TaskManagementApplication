import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  UserCircle2,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useEmployeeTimesheetDetail } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';
import { usePermission } from '../../lib/permissions/usePermission';
import { EmptyState } from '../../components/EmptyState';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type DatePreset = 'week' | 'month' | 'last30' | 'quarter' | 'all';

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  department_name: string | null;
  status: { id: string; label: string; color: string | null; category: string } | null;
  priority: { id: string; label: string; color: string | null } | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  effort_estimate_minutes: number | null;
  total_logged_minutes: number;
  time_logs: { id: string; minutes: number; note: string | null; logged_at: string; created_at: string }[];
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

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

function fmt(mins: number): string {
  if (mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = [
    'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
    'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  return colors[Math.abs(hash) % colors.length];
}

function statusBadgeStyle(category: string): string {
  const map: Record<string, string> = {
    todo: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    in_progress: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    done: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    cancelled: 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700',
  };
  return map[category] ?? map.todo;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: 'blue' | 'emerald' | 'violet' | 'amber' | 'red' | 'slate';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    slate: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  };
  return (
    <div className="neu-card p-4 sm:p-5 shadow-sm flex items-center gap-3.5 rounded-2xl">
      <div className={`rounded-xl p-2.5 shrink-0 ${colorMap[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/** Donut chart built with SVG — shows done/onTrack/overdue breakdown */
function DonutChart({ done, onTrack, overdue, total }: { done: number; onTrack: number; overdue: number; total: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pDone = total > 0 ? done / total : 0;
  const pOnTrack = total > 0 ? onTrack / total : 0;
  const pOverdue = total > 0 ? overdue / total : 0;
  const pOther = Math.max(0, 1 - pDone - pOnTrack - pOverdue);

  const segments = [
    { color: '#10b981', pct: pDone },
    { color: '#3b82f6', pct: pOnTrack },
    { color: '#ef4444', pct: pOverdue },
    { color: '#e2e8f0', pct: pOther },
  ].filter((s) => s.pct > 0);

  let offset = 0;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={136} height={136} viewBox="0 0 136 136">
        <g transform="rotate(-90 68 68)">
          {segments.map((s, i) => {
            const dash = s.pct * circ;
            const gap = circ - dash;
            const el = (
              <circle
                key={i}
                cx={68} cy={68} r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={20}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset * circ}
                strokeLinecap="butt"
              />
            );
            offset += s.pct;
            return el;
          })}
        </g>
        <text x={68} y={64} textAnchor="middle" className="fill-slate-900 dark:fill-slate-100" style={{ fontSize: 22, fontWeight: 900, fontFamily: 'inherit' }}>
          {total}
        </text>
        <text x={68} y={80} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, fontFamily: 'inherit' }}>
          tasks
        </text>
      </svg>
    </div>
  );
}

/** Daily hours bar chart — groups time_logs by day */
function DailyHoursChart({ tasks }: { tasks: TaskDetail[] }) {
  const dailyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      for (const l of t.time_logs) {
        const day = l.logged_at.split('T')[0];
        map.set(day, (map.get(day) ?? 0) + l.minutes);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);
  }, [tasks]);

  if (dailyMap.length === 0) return null;

  const maxMins = Math.max(...dailyMap.map(([, m]) => m), 1);
  const totalPeriodMins = dailyMap.reduce((s, [, m]) => s + m, 0);

  return (
    <div className="neu-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-500" />
          Daily Hours Logged
          <span className="text-xs font-normal text-slate-400 ml-1">
            ({dailyMap.length} active {dailyMap.length === 1 ? 'day' : 'days'})
          </span>
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 shrink-0" />
            <span>Time Logged</span>
          </div>
          <span className="badge text-xs" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
            Total: {fmt(totalPeriodMins)}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-3 h-44 overflow-x-auto pb-2 pt-6 px-2 no-scrollbar">
        {dailyMap.map(([day, mins]) => {
          const pct = Math.max(8, (mins / maxMins) * 100);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
          const dateObj = new Date(day + 'T12:00:00');
          const dayNum = dateObj.toLocaleDateString(undefined, { day: 'numeric' });
          const monthStr = dateObj.toLocaleDateString(undefined, { month: 'short' });

          return (
            <div key={day} className="flex flex-col items-center gap-2 min-w-[3.5rem] flex-1 max-w-[5rem] group">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap leading-none transition-transform group-hover:scale-110">
                {label}
              </span>

              <div className="relative flex items-end justify-center w-full h-24 bg-slate-100 dark:bg-slate-800/50 rounded-t-lg p-0.5">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-300 group-hover:brightness-110 shadow-sm"
                  style={{ height: `${pct}%` }}
                />
              </div>

              <div className="flex flex-col items-center leading-tight">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{dayNum}</span>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{monthStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Expandable task card with all time log entries */
function TaskCard({ task, canOpen }: { task: TaskDetail; canOpen: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const now = Date.now();
  const isOverdue = task.status?.category !== 'done' && task.due_date && new Date(task.due_date).getTime() < now;
  const effortPct = task.effort_estimate_minutes && task.effort_estimate_minutes > 0
    ? Math.min(100, (task.total_logged_minutes / task.effort_estimate_minutes) * 100)
    : null;
  const isOver = effortPct !== null && effortPct >= 100;

  return (
    <div className="neu-card !p-0 overflow-hidden shadow-sm rounded-2xl">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Priority dot */}
        {task.priority?.color && (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: task.priority.color }} title={task.priority.label} />
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {canOpen ? (
              <Link
                to={`/tasks/${task.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors break-words leading-snug"
              >
                {task.title}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">{task.title}</span>
            )}
            {task.status && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusBadgeStyle(task.status.category)}`}>
                {task.status.label}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Due: {fmtDate(task.due_date)}</span>
            {task.effort_estimate_minutes && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Estimate: {fmt(task.effort_estimate_minutes)}
              </span>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {task.time_logs.length} session{task.time_logs.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Hours + progress */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`font-black tabular-nums text-sm flex items-center gap-1 ${
            task.total_logged_minutes === 0
              ? 'text-slate-300 dark:text-slate-600'
              : isOver
                ? 'text-amber-600 dark:text-amber-400'
                : task.status?.category === 'done'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-800 dark:text-slate-200'
          }`}>
            <Clock className="w-3.5 h-3.5 opacity-70" />
            {task.total_logged_minutes === 0 ? 'No time logged' : fmt(task.total_logged_minutes)}
          </span>
          {effortPct !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-amber-500' : 'bg-brand-500 dark:bg-brand-400'}`}
                  style={{ width: `${effortPct}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium ${isOver ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {Math.round(effortPct)}%
              </span>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded: time log entries */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50/60 dark:bg-slate-950/40">
          {task.time_logs.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">No time sessions logged for this task.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Time Sessions
              </p>
              {task.time_logs.map((log, idx) => (
                <div key={log.id} className="flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 border-2 border-brand-400 dark:border-brand-500 flex items-center justify-center">
                      <span className="text-[8px] font-black text-brand-600 dark:text-brand-300">{idx + 1}</span>
                    </div>
                    {idx < task.time_logs.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1 min-h-[16px]" />
                    )}
                  </div>
                  {/* Session detail */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-brand-500" />
                        {fmt(log.minutes)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {fmtDateTime(log.logged_at)}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                        "{log.note}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {/* Summary row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 mt-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {task.time_logs.length} session{task.time_logs.length !== 1 ? 's' : ''} total
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                  {fmt(task.total_logged_minutes)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function EmployeeDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const backDeptId = searchParams.get('dept') ?? '';

  const currentUser = useSessionStore((s) => s.currentUser);
  const canDelete = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const isManagerOrAdmin =
    canDelete || canManageUsers || currentUser?.roles?.some((r: any) => r.name === 'Admin' || r.name === 'Manager');

  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [expandAll, setExpandAll] = useState(false);

  const tsRange = presetRange(datePreset);
  const { data: tasks, isLoading } = useEmployeeTimesheetDetail(userId, {
    department_id: backDeptId || undefined,
    from: tsRange?.from,
    to: tsRange?.to,
  });

  const employeeName = tasks?.[0]?.assignee_name ?? tasks?.[0]?.assignee_email ?? 'Employee';
  const employeeEmail = tasks?.[0]?.assignee_email ?? '';
  const deptName = tasks?.[0]?.department_name ?? '';

  const now = Date.now();

  // KPI aggregation
  const kpi = useMemo(() => {
    if (!tasks?.length) return { totalMins: 0, doneTasks: 0, activeTasks: 0, overdueTasks: 0, totalTasks: 0, sessionCount: 0, estimatedMins: 0 };
    const totalMins = tasks.reduce((s, t) => s + t.total_logged_minutes, 0);
    const doneTasks = tasks.filter((t) => t.status?.category === 'done').length;
    const activeTasks = tasks.filter((t) => t.status?.category !== 'done' && t.status?.category !== 'cancelled').length;
    const overdueTasks = tasks.filter((t) => t.status?.category !== 'done' && t.due_date && new Date(t.due_date).getTime() < now).length;
    const sessionCount = tasks.reduce((s, t) => s + t.time_logs.length, 0);
    const estimatedMins = tasks.reduce((s, t) => s + (t.effort_estimate_minutes ?? 0), 0);
    return { totalMins, doneTasks, activeTasks, overdueTasks, totalTasks: tasks.length, sessionCount, estimatedMins };
  }, [tasks, now]);

  const completionRate = kpi.totalTasks > 0 ? Math.round((kpi.doneTasks / kpi.totalTasks) * 100) : 0;

  // Tasks sorted: overdue first, then active, then done
  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => {
      const aOverdue = a.status?.category !== 'done' && a.due_date && new Date(a.due_date).getTime() < now ? 0 : a.status?.category === 'done' ? 2 : 1;
      const bOverdue = b.status?.category !== 'done' && b.due_date && new Date(b.due_date).getTime() < now ? 0 : b.status?.category === 'done' ? 2 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return b.total_logged_minutes - a.total_logged_minutes;
    });
  }, [tasks, now]);

  const canOpenTasks = isManagerOrAdmin || (currentUser?.id === userId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">Loading employee detail…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            to={`/tasks/timesheet/employees${backDeptId ? `?dept=${backDeptId}` : ''}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-base font-black shrink-0 ${avatarColor(employeeName)}`}>
              {initialsOf(employeeName)}
            </span>
            <div>
              <h1 className="text-2xl">{employeeName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {emailLabel(employeeEmail, deptName)}
              </p>
            </div>
          </div>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['week', 'month', 'last30', 'quarter', 'all'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                datePreset === p
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p === 'week' ? 'Week' : p === 'month' ? 'Month' : p === 'last30' ? '30 Days' : p === 'quarter' ? '3 Months' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip — 3 cards, evenly distributed */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard icon={<Clock className="w-4 h-4" />} label="Total Hours Logged" value={fmt(kpi.totalMins)} sub={`${kpi.sessionCount} sessions`} color="blue" />
        <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Tasks Completed" value={String(kpi.doneTasks)} sub={`${completionRate}% completion rate`} color="emerald" />
        <KpiCard icon={<AlertCircle className="w-4 h-4" />} label="Overdue Tasks" value={String(kpi.overdueTasks)} color={kpi.overdueTasks > 0 ? 'red' : 'slate'} />
      </div>

      {/* Summary + Donut */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Donut chart */}
        <div className="neu-card p-5 sm:p-6 shadow-sm flex flex-col items-center gap-4 rounded-2xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 self-start flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-500" />
            Task Breakdown
          </h3>
          {(() => {
            const onTrackTasks = Math.max(0, kpi.activeTasks - kpi.overdueTasks);
            return (
              <>
                <DonutChart done={kpi.doneTasks} onTrack={onTrackTasks} overdue={kpi.overdueTasks} total={kpi.totalTasks} />
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    Completed ({kpi.doneTasks})
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    On Track ({onTrackTasks})
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    Overdue ({kpi.overdueTasks})
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Productivity stats */}
        <div className="sm:col-span-2 neu-card p-5 sm:p-6 shadow-sm rounded-2xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            Productivity Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <StatRow label="Total Tasks" value={String(kpi.totalTasks)} />
            <StatRow label="Avg Hours per Task" value={kpi.totalTasks > 0 ? fmt(Math.round(kpi.totalMins / kpi.totalTasks)) : '—'} />
            <StatRow label="Estimated Hours" value={kpi.estimatedMins > 0 ? fmt(kpi.estimatedMins) : '—'} />
            <StatRow label="Actual Hours" value={fmt(kpi.totalMins)} />
            <StatRow label="Sessions Logged" value={String(kpi.sessionCount)} />
            <StatRow label="Avg per Session" value={kpi.sessionCount > 0 ? fmt(Math.round(kpi.totalMins / kpi.sessionCount)) : '—'} />
          </div>
        </div>
      </div>

      {/* Daily chart */}
      {tasks && tasks.length > 0 && <DailyHoursChart tasks={tasks} />}

      {/* Task list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            Task Sessions
            <span className="text-xs font-normal text-slate-400 ml-1">({sortedTasks.length} tasks)</span>
          </h3>
          {sortedTasks.length > 0 && (
            <button
              onClick={() => setExpandAll((e) => !e)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              {expandAll ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        {!tasks || tasks.length === 0 ? (
          <div className="neu-card p-8 shadow-sm rounded-2xl">
            <EmptyState
              icon={<UserCircle2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
              title="No Tasks Found"
              subtitle="No tasks found for this employee in the selected period. Try a broader date range."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map((task) => (
              <ExpandableTaskCard key={task.id} task={task} canOpen={canOpenTasks} forceExpand={expandAll} />
            ))}
          </div>
        )}
      </div>

      {/* Footer total */}
      {tasks && tasks.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-5 py-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {kpi.totalTasks} tasks · {kpi.sessionCount} sessions
          </span>
          <span className="text-base font-black text-slate-900 dark:text-slate-100 tabular-nums flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-brand-500" />
            {fmt(kpi.totalMins)} total
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Helper sub-components ─────────────────────────────────────────────── */

function emailLabel(email: string, dept: string): string {
  const parts = [email, dept].filter(Boolean);
  return parts.join(' · ') || 'Employee';
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
    </div>
  );
}

/** Wraps TaskCard but accepts a forceExpand override */
function ExpandableTaskCard({ task, canOpen, forceExpand }: { task: TaskDetail; canOpen: boolean; forceExpand: boolean }) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = forceExpand || localExpanded;
  const now = Date.now();
  const isOverdue = task.status?.category !== 'done' && task.due_date && new Date(task.due_date).getTime() < now;
  const effortPct = task.effort_estimate_minutes && task.effort_estimate_minutes > 0
    ? Math.min(100, (task.total_logged_minutes / task.effort_estimate_minutes) * 100)
    : null;
  const isOver = effortPct !== null && effortPct >= 100;

  return (
    <div className="neu-card !p-0 overflow-hidden shadow-sm rounded-2xl">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
        onClick={() => setLocalExpanded((e) => !e)}
      >
        {task.priority?.color && (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: task.priority.color }} title={task.priority.label} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {canOpen ? (
              <Link
                to={`/tasks/${task.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors break-words leading-snug"
              >
                {task.title}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">{task.title}</span>
            )}
            {task.status && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusBadgeStyle(task.status.category)}`}>
                {task.status.label}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Due: {fmtDate(task.due_date)}</span>
            {task.effort_estimate_minutes ? <span className="text-[11px] text-slate-400 dark:text-slate-500">Est: {fmt(task.effort_estimate_minutes)}</span> : null}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{task.time_logs.length} session{task.time_logs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`font-black tabular-nums text-sm flex items-center gap-1 ${task.total_logged_minutes === 0 ? 'text-slate-300 dark:text-slate-600' : isOver ? 'text-amber-600 dark:text-amber-400' : task.status?.category === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
            <Clock className="w-3.5 h-3.5 opacity-70" />
            {task.total_logged_minutes === 0 ? 'No time' : fmt(task.total_logged_minutes)}
          </span>
          {effortPct !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isOver ? 'bg-amber-500' : 'bg-brand-500 dark:bg-brand-400'}`} style={{ width: `${effortPct}%` }} />
              </div>
              <span className={`text-[10px] font-medium ${isOver ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>{Math.round(effortPct)}%</span>
            </div>
          )}
        </div>
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50/60 dark:bg-slate-950/40">
          {task.time_logs.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">No time sessions logged for this task.</p>
          ) : (
            <div className="space-y-0">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Time Sessions</p>
              {task.time_logs.map((log, idx) => (
                <div key={log.id} className="flex items-start gap-3 mb-2">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 border-2 border-brand-400 dark:border-brand-500 flex items-center justify-center">
                      <span className="text-[8px] font-black text-brand-600 dark:text-brand-300">{idx + 1}</span>
                    </div>
                    {idx < task.time_logs.length - 1 && <div className="w-px bg-slate-200 dark:bg-slate-700 mt-1 h-4" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-brand-500" />{fmt(log.minutes)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDateTime(log.logged_at)}</span>
                    </div>
                    {log.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">"{log.note}"</p>}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{task.time_logs.length} session{task.time_logs.length !== 1 ? 's' : ''} total</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">{fmt(task.total_logged_minutes)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
