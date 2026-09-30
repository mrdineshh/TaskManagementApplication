import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ListTodo, Search, X, Plus, SlidersHorizontal, Archive, Users, ArrowRight, Filter, Link2, Repeat } from "lucide-react";
import { useDepartments, usePriorities, useTasks, useUsers, useWorkflowStatuses, useWorkflows } from "../../features/tasks/hooks";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { NeuSelect } from "../../components/NeuSelect";
import { NewTaskForm } from "../../features/tasks/NewTaskForm";
import { WorkSessionTimer } from "../../features/tasks/WorkSessionTimer";
import { apiClient } from "../../lib/api-client/client";
import { usePermission } from "../../lib/permissions/usePermission";
import { useSessionStore } from "../../lib/auth/session-store";
import { fmtDate } from "../../lib/utils/dates";

export function TaskListPage() {
  const [params, setParams]           = useSearchParams();
  const [showNewTask, setShowNewTask] = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus]   = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const qc          = useQueryClient();
  const currentUser = useSessionStore((s) => s.currentUser);

  const canCreate       = usePermission("task.create");
  const canAssign       = usePermission("task.assign");
  const canDelete       = usePermission("task.delete");
  const canManageUsers  = usePermission("user.manage");
  const isManagerOrAdmin = canDelete || canManageUsers ||
    currentUser?.roles?.some((r: any) => r.name === "Admin" || r.name === "Manager");

  const departmentId = params.get("department_id") ?? undefined;
  const assigneeIds  = params.get("assignee_id")   ?? undefined;
  const statusId     = params.get("status_id")     ?? undefined;
  const priorityId   = params.get("priority_id")   ?? undefined;
  const searchQuery  = params.get("q")             ?? "";
  const overdue      = params.get("overdue")       === "true";
  const overBudget   = params.get("over_budget")   === "true";
  const dueThisWeek  = params.get("due_this_week") === "true";
  const statusParam  = params.get("status")        ?? (overdue ? "overdue" : "all");

  const hasDrillFilters = Boolean(departmentId || assigneeIds || statusId || priorityId || searchQuery || overdue || overBudget || dueThisWeek || (statusParam !== "all"));

  const { data: departments } = useDepartments();
  const { data: workflows }   = useWorkflows();
  // Fall back to first workflow if none is marked default, so statuses always load
  const defaultWorkflow = workflows?.find((w) => w.is_default) ?? workflows?.[0];
  const { data: statuses }    = useWorkflowStatuses(defaultWorkflow?.id);
  const { data: priorities }  = usePriorities(departmentId);
  const { data: members }     = useUsers(departmentId, isManagerOrAdmin);

  const { data, isLoading, isError } = useTasks({
    department_id: departmentId,
    assignee_id:   assigneeIds,
    priority_id:   priorityId,
    q:             searchQuery || undefined,
    over_budget:   overBudget ? "true" : undefined,
    due_this_week: dueThisWeek ? "true" : undefined,
  });

  const rawTasks = data?.items ?? [];

  const counts = useMemo(() => {
    let all = 0, todo = 0, inProgress = 0, done = 0, overdueCount = 0, blocked = 0;
    const now = Date.now();
    for (const taskItem of rawTasks) {
      const t = taskItem as any;
      all++;
      const cat = t.status?.category ?? t.status?.key;
      if (cat === "done") {
        done++;
      } else if (cat === "in_progress") {
        inProgress++;
      } else {
        todo++;
      }

      const isDone = cat === "done";
      if (!isDone && t.due_date && new Date(t.due_date).getTime() < now) {
        overdueCount++;
      }
      if ((t as any).is_blocked || (t as any).open_blocker_count > 0 || (t as any).dependencies?.some((d: any) => d.type === "blocks")) {
        blocked++;
      }
    }
    return { all, todo, inProgress, done, overdue: overdueCount, blocked };
  }, [rawTasks]);

  const tasks = useMemo(() => {
    const now = Date.now();
    return rawTasks.filter((t: any) => {
      if (statusId && t.status_id !== statusId && t.status?.id !== statusId) {
        return false;
      }
      const cat = t.status?.category ?? t.status?.key;
      const isDone = cat === "done";
      if (statusParam === "todo") return cat !== "in_progress" && cat !== "done";
      if (statusParam === "in_progress") return cat === "in_progress";
      if (statusParam === "done") return cat === "done";
      if (statusParam === "overdue") return !isDone && t.due_date && new Date(t.due_date).getTime() < now;
      if (statusParam === "blocked") {
        return (t as any).is_blocked || (t as any).open_blocker_count > 0 || (t as any).dependencies?.some((d: any) => d.type === "blocks");
      }
      return true;
    });
  }, [rawTasks, statusParam, statusId]);

  // Resolve chip labels from reference data, not from returned tasks
  // This ensures labels still show even when the filter returns 0 results
  const departmentName = departments?.find((d) => d.id === departmentId)?.name;
  const statusLabel    = statusId   ? (statuses?.find((s: any) => s.id === statusId)?.label ?? statusId) : null;
  const priorityLabel  = priorityId ? (priorities?.find((p: any) => p.id === priorityId)?.label ?? priorityId) : null;
  const assigneeLabel  = useMemo(() => {
    if (!assigneeIds) return null;
    const ids = assigneeIds.split(",").filter(Boolean);
    if (ids.length === 0) return null;
    if (ids.length === 1) {
      const member = (members as any[])?.find((m: any) => m.id === ids[0]);
      const name = member?.full_name ?? (tasks[0] as any)?.assignee?.full_name;
      return name ? `${name}'s tasks` : "1 person";
    }
    return `${ids.length} team members`;
  }, [assigneeIds, members, tasks]);

  const selectableTasks = useMemo(() =>
    tasks.filter((t: any) => isManagerOrAdmin || (t.assignee_id ?? t.assignee?.id) === currentUser?.id),
    [tasks, isManagerOrAdmin, currentUser?.id]);

  const allSelected = selectableTasks.length > 0 && selectableTasks.every((t) => selected.has(t.id));

  function toggleAll()         { setSelected(allSelected ? new Set() : new Set(selectableTasks.map((t) => t.id))); }
  function toggleOne(id: string) { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function runBulk(action: "reassign" | "transition" | "archive", payload: { assignee_id?: string | null; status_id?: string } = {}) {
    setBulkPending(true);
    try {
      const res = await apiClient.tasks.bulk({ ids: [...selected], action, ...payload });
      setBulkStatus(res.failed > 0 ? `${res.succeeded} updated, ${res.failed} failed.` : `${res.succeeded} task(s) updated.`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err) { setBulkStatus(err instanceof Error ? err.message : "Bulk action failed"); }
    finally { setBulkPending(false); }
  }

  function setParam(key: string, val: string) {
    setParams((p) => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); return n; });
  }

  function handleStatusFilter(filter: "all" | "todo" | "in_progress" | "done" | "overdue" | "blocked") {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (filter === "all") {
        n.delete("status");
        n.delete("overdue");
        n.delete("status_id");
      } else if (filter === "overdue") {
        n.set("status", "overdue");
        n.set("overdue", "true");
        n.delete("status_id");
      } else {
        n.set("status", filter);
        n.delete("overdue");
        n.delete("status_id");
      }
      return n;
    });
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">All Tasks</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}{hasDrillFilters ? " (filtered)" : ""}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowNewTask((v) => !v)} className="btn-primary gap-2">
            {showNewTask ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showNewTask ? "Cancel" : "New Task"}
          </button>
        )}
      </div>

      {/* New task form */}
      {showNewTask && (
        <div className="neu-card animate-pop-in">
          <NewTaskForm onDone={() => setShowNewTask(false)} />
        </div>
      )}

      {/* Bulk status toast */}
      {bulkStatus && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold animate-fade-in bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 shadow-2xs"
        >
          <span>{bulkStatus}</span>
          <button onClick={() => setBulkStatus(null)} className="ml-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Active drill-down filter chips */}
      {hasDrillFilters && (
        <div className="flex flex-wrap items-center gap-2 neu-card !p-2.5 !rounded-xl">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" style={{ color: "#2563EB" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Active filters:</span>
          {departmentName && <Badge color="blue">{departmentName}</Badge>}
          {assigneeLabel  && <Badge color="blue">{assigneeLabel}</Badge>}
          {statusLabel    && <Badge color="blue">Status: {statusLabel}</Badge>}
          {priorityLabel  && <Badge color="blue">Priority: {priorityLabel}</Badge>}
          {overdue        && <Badge color="red">Overdue</Badge>}
          {overBudget     && <Badge color="amber">Over Budget</Badge>}
          {dueThisWeek    && <Badge color="purple">Due This Week</Badge>}
          <button onClick={() => setParams({})} className="ml-auto btn-ghost text-xs">
            <X className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}

      {/* Filter controls — standardized with Gantt Timeline & Timesheet */}
      <div className="space-y-2.5">
        {/* Row 1: Search & secondary selectors */}
        <div className="neu-card !p-3 sm:!p-3.5 flex flex-wrap items-center gap-3 rounded-2xl shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search tasks…"
              className="neu-input pl-9 py-1.5 text-xs"
            />
          </div>

          {/* Department selector */}
          <NeuSelect
            value={departmentId ?? ""}
            onChange={(v) => setParam("department_id", v)}
            options={[
              { value: "", label: "All Departments" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            placeholder="All Departments"
            compact
            style={{ minWidth: "140px" }}
          />

          {/* Priority selector */}
          <NeuSelect
            value={priorityId ?? ""}
            onChange={(v) => setParam("priority_id", v)}
            options={[
              { value: "", label: "All Priorities" },
              ...(priorities ?? []).map((p) => ({ value: p.id, label: p.label })),
            ]}
            placeholder="All Priorities"
            compact
            style={{ minWidth: "125px" }}
          />

          {/* Assignee selector for managers/admins */}
          {isManagerOrAdmin && (
            <NeuSelect
              value={assigneeIds ?? ""}
              onChange={(v) => setParam("assignee_id", v)}
              options={[
                { value: "", label: "All Members" },
                ...((members as any[]) ?? []).map((m: any) => ({ value: m.id, label: m.full_name })),
              ]}
              placeholder="All Members"
              compact
              style={{ minWidth: "140px" }}
            />
          )}

          {(hasDrillFilters || searchQuery) && (
            <button
              type="button"
              onClick={() => setParams({})}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:border-slate-400 transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        {/* Row 2: Status Filter Strip — Identical to Gantt of Timeline */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs shadow-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mr-2 px-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Status Filter:</span>
          </div>
          <FilterLegendButton
            label="All"
            count={counts.all}
            isActive={statusParam === "all"}
            onClick={() => handleStatusFilter("all")}
            color="#475569"
          />
          <FilterLegendButton
            label="To Do"
            count={counts.todo}
            isActive={statusParam === "todo"}
            onClick={() => handleStatusFilter("todo")}
            color="#64748b"
          />
          <FilterLegendButton
            label="In Progress"
            count={counts.inProgress}
            isActive={statusParam === "in_progress"}
            onClick={() => handleStatusFilter("in_progress")}
            color="#2563eb"
          />
          <FilterLegendButton
            label="Completed"
            count={counts.done}
            isActive={statusParam === "done"}
            onClick={() => handleStatusFilter("done")}
            color="#16a34a"
          />
          <FilterLegendButton
            label="Overdue"
            count={counts.overdue}
            isActive={statusParam === "overdue"}
            onClick={() => handleStatusFilter("overdue")}
            color="#dc2626"
          />
          <FilterLegendButton
            label="Blocked"
            count={counts.blocked}
            isActive={statusParam === "blocked"}
            onClick={() => handleStatusFilter("blocked")}
            color="#f59e0b"
            icon={<Link2 className="w-3 h-3 text-amber-500" />}
          />
          {hasDrillFilters && (
            <button
              type="button"
              onClick={() => setParams({})}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 transition-all"
            >
              <X className="w-3 h-3" />
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="neu-table min-w-[1020px]" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: "2.75rem" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--neu-dark)", color: "var(--text-faint)" }}>
                <th className="w-10 pl-5 pr-2 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectableTasks.length === 0}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="w-4 h-4 rounded accent-brand-500 disabled:opacity-30"
                  />
                </th>
                <th className="px-3 py-3 text-left whitespace-nowrap min-w-[180px]">Title</th>
                <th className="px-3 py-3 text-left whitespace-nowrap min-w-[105px]">Time Logged</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Department</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Priority</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Assigned To</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Assigned By</th>
                <th className="px-3 pr-4 py-3 text-left whitespace-nowrap">Due</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(9)].map((__, j) => (
                    <td key={j} className="px-3 py-3.5">
                      <div className="h-4 rounded skeleton" style={{ width: j === 1 ? "12rem" : "5rem" }} />
                    </td>
                  ))}
                </tr>
              ))}
              {isError && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-sm" style={{ color: "#ef4444" }}>
                    Failed to load tasks. Check your connection and refresh.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && tasks.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={<ListTodo className="w-8 h-8" style={{ color: "var(--text-faint)" }} />}
                      title="No tasks found"
                      subtitle={hasDrillFilters ? "No tasks match these filters." : "Create your first task to get started."}
                      action={!hasDrillFilters ? { label: "Create Task", onClick: () => setShowNewTask(true) } : undefined}
                    />
                  </td>
                </tr>
              )}
              {tasks.map((t: any) => {
                const isSelf     = (t.assignee_id ?? t.assignee?.id) === currentUser?.id;
                const canOpen    = isManagerOrAdmin || isSelf;
                const canSelect  = isManagerOrAdmin || isSelf;
                const hasTimer   = Boolean(t.timerStartedAt ?? t.timer_started_at);
                const loggedMins = t.totalLoggedMinutes ?? t.total_logged_minutes ?? 0;
                return (
                  <tr key={t.id} style={selected.has(t.id) ? { background: "rgba(37,99,235,0.05)" } : undefined}>
                    <td className="w-10 pl-5 pr-2 py-3.5 align-middle">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleOne(t.id)}
                          aria-label={`Select "${t.title}"`}
                          className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                        />
                      ) : (
                        <input type="checkbox" disabled className="w-4 h-4 rounded opacity-20 cursor-not-allowed" />
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-middle min-w-[180px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canOpen ? (
                          <Link
                            to={`/tasks/${t.id}`}
                            className="font-semibold text-sm hover:text-gradient transition-colors inline-flex items-center gap-1 group break-words"
                            style={{ color: "var(--text-primary)" }}
                          >
                            <span className="leading-snug break-words">{t.title}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "#2563EB" }} />
                          </Link>
                        ) : (
                          <span className="font-semibold text-sm leading-snug break-words" style={{ color: "var(--text-muted)" }}>{t.title}</span>
                        )}
                        {(t.is_recurring || (t.recurrence_index && t.recurrence_index > 1) || t.recurrence_parent_id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 shrink-0">
                            <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0 mr-0.5" />
                            <span>#{t.recurrence_index ?? 1}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap min-w-[105px]">
                      {(hasTimer || loggedMins > 0) ? (
                        <WorkSessionTimer
                          timerStartedAt={t.timerStartedAt ?? t.timer_started_at ?? null}
                          totalLoggedMinutes={loggedMins}
                          size="chip"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-600 pl-2">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span className="text-xs font-medium leading-snug break-words block" style={{ color: "var(--text-muted)" }}>{t.department?.name ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      {t.status && <Badge label={t.status.label} color={t.status.color} />}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      {t.priority && <Badge label={t.priority.label} color={t.priority.color} />}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span className="text-sm leading-snug break-words block" style={{ color: "var(--text-muted)" }}>{t.assignee?.full_name ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span className="text-sm leading-snug break-words block" style={{ color: "var(--text-faint)" }}>{t.created_by?.full_name ?? t.createdBy?.full_name ?? "—"}</span>
                    </td>
                    <td className="px-3 pr-4 py-3.5 align-middle whitespace-nowrap">
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{fmtDate(t.due_date)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 animate-pop-in"
          style={{
            background: "var(--neu-bg)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <span className="text-sm font-bold" style={{ color: "#2563EB" }}>{selected.size} selected</span>
          <div className="w-px h-5" style={{ background: "var(--neu-dark)" }} />

          {canAssign && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
              <NeuSelect
                value=""
                onChange={(v) => { if (v) runBulk("reassign", { assignee_id: v === "__unassign__" ? null : v }); }}
                options={[
                  { value: "__unassign__", label: "Unassign" },
                  ...((members as any[]) ?? []).map((m: any) => ({ value: m.id, label: m.full_name })),
                ]}
                placeholder="Reassign to…"
                compact
                disabled={bulkPending}
                style={{ minWidth: "8.5rem" }}
              />
            </div>
          )}

          <NeuSelect
            value=""
            onChange={(v) => { if (v) runBulk("transition", { status_id: v }); }}
            options={(statuses ?? []).map((s: any) => ({ value: s.id, label: s.label }))}
            placeholder="Move to status…"
            compact
            disabled={bulkPending}
            style={{ minWidth: "9.5rem" }}
          />

          {canDelete && (
            <button
              disabled={bulkPending}
              onClick={() => { if (window.confirm(`Archive ${selected.size} task(s)?`)) runBulk("archive"); }}
              className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900 border-2 border-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-900 dark:text-slate-100 !py-1.5 !px-3 !text-xs font-semibold shadow-2xs transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-red-600" /> Archive
            </button>
          )}

          <button onClick={() => setSelected(new Set())} className="nav-icon-btn w-7 h-7">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function FilterLegendButton({
  label,
  count,
  isActive,
  onClick,
  color,
  icon,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
        isActive
          ? "bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 shadow-2xs"
          : "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400"
      }`}
    >
      {icon ? icon : <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
          isActive
            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
