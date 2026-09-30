import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  UserCircle2,
  Filter,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { useDepartments, useTimesheetRows } from '../../features/tasks/hooks';
import { EmptyState } from '../../components/EmptyState';
import { NeuSelect } from '../../components/NeuSelect';
import { useSessionStore } from '../../lib/auth/session-store';
import { usePermission } from '../../lib/permissions/usePermission';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type DatePreset = 'week' | 'month' | 'last30' | 'quarter' | 'all';
type SortKey = 'name' | 'department' | 'total_tasks' | 'active_tasks' | 'done_tasks' | 'hours';
type SortDir = 'asc' | 'desc';

interface EmployeeRow {
  assignee_id: string;
  name: string;
  email: string;
  department_name: string;
  total_tasks: number;
  active_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
  total_logged_minutes: number;
  avg_minutes_per_task: number;
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

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = [
    'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
    'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
    'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  return colors[Math.abs(hash) % colors.length];
}


/* ─── Sub-components ─────────────────────────────────────────────────────── */

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
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

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`py-3 px-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function EmployeeTimesheetPage() {
  const navigate = useNavigate();
  const currentUser = useSessionStore((s) => s.currentUser);
  const canDelete = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const isManagerOrAdmin =
    canDelete || canManageUsers || currentUser?.roles?.some((r: any) => r.name === 'Admin' || r.name === 'Manager');

  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [sortKey, setSortKey] = useState<SortKey>('hours');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const tsRange = presetRange(datePreset);
  const { data: timesheetData, isLoading } = useTimesheetRows({
    department_id: departmentId || undefined,
    from: tsRange?.from,
    to: tsRange?.to,
  });

  const deptName = departments?.find((d: any) => d.id === departmentId)?.name ?? '';

  // Group task rows by employee
  const employeeRows = useMemo((): EmployeeRow[] => {
    if (!timesheetData) return [];

    const now = Date.now();
    const map = new Map<string, EmployeeRow>();

    for (const row of timesheetData) {
      const key = row.assignee_id ?? '__unassigned__';
      const name = row.assignee_name ?? row.assignee_email ?? 'Unassigned';

      if (!map.has(key)) {
        map.set(key, {
          assignee_id: key,
          name,
          email: row.assignee_email ?? '',
          department_name: row.department_name ?? '',
          total_tasks: 0,
          active_tasks: 0,
          done_tasks: 0,
          overdue_tasks: 0,
          total_logged_minutes: 0,
          avg_minutes_per_task: 0,
        });
      }

      const emp = map.get(key)!;
      emp.total_tasks += 1;
      emp.total_logged_minutes += row.total_logged_minutes;

      const isDone = row.status?.category === 'done';
      const isCancelled = row.status?.category === 'cancelled';
      const isOverdue = !isDone && row.due_date && new Date(row.due_date).getTime() < now;

      if (isDone) emp.done_tasks += 1;
      else if (!isCancelled) emp.active_tasks += 1;
      if (isOverdue) emp.overdue_tasks += 1;
    }

    // Compute avg after grouping
    for (const emp of map.values()) {
      emp.avg_minutes_per_task = emp.total_tasks > 0 ? emp.total_logged_minutes / emp.total_tasks : 0;
    }

    // Non-privileged users see only their own row
    if (!isManagerOrAdmin) {
      const myKey = currentUser?.id ?? '__unassigned__';
      const myRow = map.get(myKey);
      return myRow ? [myRow] : [];
    }

    return Array.from(map.values());
  }, [timesheetData, isManagerOrAdmin, currentUser?.id]);

  // Filter by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return employeeRows;
    const q = search.toLowerCase();
    return employeeRows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.department_name.toLowerCase().includes(q),
    );
  }, [employeeRows, search]);

  // Sort
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let av: unknown, bv: unknown;
      if (sortKey === 'name') { av = a.name; bv = b.name; }
      else if (sortKey === 'department') { av = a.department_name; bv = b.department_name; }
      else if (sortKey === 'total_tasks') { av = a.total_tasks; bv = b.total_tasks; }
      else if (sortKey === 'active_tasks') { av = a.active_tasks; bv = b.active_tasks; }
      else if (sortKey === 'done_tasks') { av = a.done_tasks; bv = b.done_tasks; }
      else { av = a.total_logged_minutes; bv = b.total_logged_minutes; }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir]);

  // KPI stats
  const kpi = useMemo(() => {
    const totalEmployees = employeeRows.length;
    const totalMins = employeeRows.reduce((s, r) => s + r.total_logged_minutes, 0);
    const totalHours = totalMins / 60;
    const avgHoursPerEmployee = totalEmployees > 0 ? totalHours / totalEmployees : 0;
    const overdueCount = employeeRows.filter((r) => r.overdue_tasks > 0).length;
    const totalDone = employeeRows.reduce((s, r) => s + r.done_tasks, 0);
    const totalActive = employeeRows.reduce((s, r) => s + r.active_tasks, 0);
    return { totalEmployees, totalHours, avgHoursPerEmployee, overdueCount, totalDone, totalActive };
  }, [employeeRows]);

  const maxMinutes = useMemo(
    () => Math.max(...sortedRows.map((r) => r.total_logged_minutes), 1),
    [sortedRows],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            Employee Timesheet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hours logged and task activity per team member · Downloadable CSV
          </p>
        </div>
        {isManagerOrAdmin && (
          <NeuSelect
            value={departmentId}
            onChange={setDepartmentId}
            options={[
              { value: '', label: 'All Departments' },
              ...(departments ?? []).map((d: any) => ({ value: d.id, label: d.name })),
            ]}
            placeholder="All Departments"
            compact
            style={{ minWidth: '160px' }}
          />
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Team Members"
          value={String(kpi.totalEmployees)}
          color="blue"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Tasks Completed"
          value={String(kpi.totalDone)}
          sub={`${kpi.totalActive} still active`}
          color="emerald"
        />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Members with Overdue"
          value={String(kpi.overdueCount)}
          color={kpi.overdueCount > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3 neu-card px-5 py-3.5 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Period:</span>
        </div>
        {(['week', 'month', 'last30', 'quarter', 'all'] as DatePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setDatePreset(p)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              datePreset === p
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-blue-600 shadow-2xs'
                : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
            }`}
          >
            {p === 'week'
              ? 'This Week'
              : p === 'month'
                ? 'This Month'
                : p === 'last30'
                  ? 'Last 30 Days'
                  : p === 'quarter'
                    ? 'Last 3 Months'
                    : 'All Time'}
          </button>
        ))}

        {isManagerOrAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
            />
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center neu-card p-8 rounded-2xl">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">Loading employee timesheet…</p>
          </div>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="neu-card p-8 shadow-sm rounded-2xl">
          <EmptyState
            icon={<UserCircle2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            title="No Employee Data"
            subtitle={
              search
                ? `No employees found matching "${search}". Try a different name.`
                : 'No task data found for the selected filters. Try a broader date range or department.'
            }
          />
        </div>
      ) : (
        <div className="neu-card !p-0 overflow-hidden shadow-md rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60">
                  <SortTh
                    label="Employee"
                    sortKey="name"
                    current={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                    className="pl-5 w-64"
                  />
                  {isManagerOrAdmin && (
                    <SortTh
                      label="Department"
                      sortKey="department"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                  )}
                  <SortTh label="Total Tasks" sortKey="total_tasks" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Active" sortKey="active_tasks" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Completed" sortKey="done_tasks" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="py-3 px-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    Overdue
                  </th>
                  <SortTh
                    label="Hours Logged"
                    sortKey="hours"
                    current={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                    className="pr-5 text-right w-52"
                  />
                </tr>
              </thead>
              <tbody className="">
                {sortedRows.map((emp) => {
                  const barPct = maxMinutes > 0 ? Math.min(100, (emp.total_logged_minutes / maxMinutes) * 100) : 0;
                  const hasOverdue = emp.overdue_tasks > 0;

                  return (
                    <tr
                      key={emp.assignee_id}
                      onClick={() => navigate(`/tasks/timesheet/employees/${emp.assignee_id}${departmentId ? `?dept=${departmentId}` : ''}`)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    >
                      {/* Employee */}
                      <td className="pl-5 pr-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold shrink-0 ${avatarColor(emp.name)}`}
                          >
                            {initialsOf(emp.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold leading-snug break-words" style={{ color: "var(--text-primary)" }}>
                              {emp.name}
                            </p>
                            {emp.email && (
                              <p className="text-[11px] leading-snug break-words" style={{ color: "var(--text-faint)" }}>{emp.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      {isManagerOrAdmin && (
                        <td className="px-3 py-3.5 text-xs text-slate-500 dark:text-slate-400 break-words leading-snug">
                          {emp.department_name || '—'}
                        </td>
                      )}

                      {/* Total Tasks */}
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                          {emp.total_tasks}
                        </span>
                      </td>

                      {/* Active Tasks */}
                      <td className="px-3 py-3.5">
                        {emp.active_tasks > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-blue-600 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            {emp.active_tasks}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Completed */}
                      <td className="px-3 py-3.5">
                        {emp.done_tasks > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-emerald-600 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {emp.done_tasks}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Overdue */}
                      <td className="px-3 py-3.5">
                        {hasOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-red-600 shadow-2xs">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            {emp.overdue_tasks}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Hours with mini bar */}
                      <td className="pl-3 pr-5 py-3.5">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`font-black tabular-nums text-sm ${
                              emp.total_logged_minutes === 0
                                ? 'text-slate-300 dark:text-slate-600'
                                : emp.total_logged_minutes >= 480
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {emp.total_logged_minutes === 0 ? (
                              <span className="font-normal text-xs text-slate-400 dark:text-slate-600">
                                No time logged
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 opacity-70" />
                                {fmt(emp.total_logged_minutes)}
                              </span>
                            )}
                          </span>
                          {emp.total_logged_minutes > 0 && (
                            <>
                              <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-brand-500 dark:bg-brand-400 transition-all"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                avg {fmt(Math.round(emp.avg_minutes_per_task))}/task
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      {/* Chevron affordance */}
                      <td className="pr-4 py-3.5 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60">
                  <td
                    colSpan={isManagerOrAdmin ? 6 : 5}
                    className="pl-5 pr-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    {sortedRows.length} {sortedRows.length === 1 ? 'employee' : 'employees'} · {kpi.totalDone} tasks
                    completed · {kpi.totalActive} active
                  </td>
                  <td className="pl-3 pr-5 py-3 text-right text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {fmt(sortedRows.reduce((s, r) => s + r.total_logged_minutes, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Active = in progress / pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Completed = marked done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Overdue = past due date, not done</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <BarChart3 className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Bar shows relative hours within period</span>
        </div>
      </div>
    </div>
  );
}
