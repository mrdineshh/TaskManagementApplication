import { useMemo, useRef, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ListTodo, Search, X, Plus, SlidersHorizontal, Archive, Users, ArrowRight, ChevronDown } from "lucide-react";
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
  const hasDrillFilters = Boolean(assigneeIds || statusId || priorityId || searchQuery || overdue || overBudget || dueThisWeek);

  const { data: departments } = useDepartments();
  const { data: workflows }   = useWorkflows();
  const defaultWorkflow       = workflows?.find((w) => w.is_default);
  const { data: statuses }    = useWorkflowStatuses(defaultWorkflow?.id);
  const { data: priorities }  = usePriorities(departmentId);
  const { data: members }     = useUsers(departmentId, isManagerOrAdmin);

  const { data, isLoading, isError } = useTasks({
    department_id: departmentId,
    assignee_id:   assigneeIds,
    status_id:     statusId,
    priority_id:   priorityId,
    q:             searchQuery || undefined,
    overdue:       overdue    ? "true" : undefined,
    over_budget:   overBudget ? "true" : undefined,
    due_this_week: dueThisWeek ? "true" : undefined,
  });

  const tasks = data?.items ?? [];

  const assigneeLabel = useMemo(() => {
    if (!assigneeIds || !tasks.length) return null;
    const ids = assigneeIds.split(",");
    if (ids.length === 1) { const n = (tasks[0] as any)?.assignee?.full_name; return n ? `${n}'s tasks` : "1 person"; }
    return `${ids.length} team members`;
  }, [assigneeIds, tasks]);

  const statusLabel   = statusId   ? (tasks[0] as any)?.status?.label   : null;
  const priorityLabel = priorityId ? (tasks[0] as any)?.priority?.label : null;
  const departmentName = departments?.find((d) => d.id === departmentId)?.name;

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

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const activeFilterCount = [departmentId, statusId, priorityId, assigneeIds].filter(Boolean).length;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const selectCls = "w-full neu-input py-2 px-3 text-sm cursor-pointer appearance-none pr-8";

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
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium animate-fade-in"
          style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB", border: "1px solid rgba(37,99,235,0.2)" }}
        >
          {bulkStatus}
          <button onClick={() => setBulkStatus(null)} className="ml-2 text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Active drill-down filter chips */}
      {hasDrillFilters && (
        <div className="flex flex-wrap items-center gap-2 neu-inset">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" style={{ color: "#2563EB" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Active filters:</span>
          {departmentName && <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>{departmentName}</span>}
          {assigneeLabel  && <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>{assigneeLabel}</span>}
          {statusLabel    && <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>Status: {statusLabel}</span>}
          {priorityLabel  && <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>Priority: {priorityLabel}</span>}
          {overdue        && <span className="badge" style={{ background: "rgba(239,68,68,0.1)",   color: "#ef4444" }}>Overdue</span>}
          {overBudget     && <span className="badge" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>Over Budget</span>}
          {dueThisWeek    && <span className="badge" style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>Due This Week</span>}
          <button onClick={() => setParams({})} className="ml-auto btn-ghost text-xs">
            <X className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}

      {/* Filter bar — compact single row */}
      <div className="neu-card !p-3 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search tasks…"
            className="neu-input pl-9 py-2"
          />
        </div>

        {/* Filters button with popover */}
        <div ref={filterRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="btn-neu flex items-center gap-2 !py-2 !px-4 !text-sm relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: "#2563EB" }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>

          {filterOpen && (
            <div
              className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl p-4 space-y-3 animate-pop-in"
              style={{
                background: "var(--neu-bg)",
                boxShadow: "8px 8px 24px var(--neu-dark), -4px -4px 12px var(--neu-light)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Filter by</p>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Department</label>
                  <NeuSelect
                    value={departmentId ?? ""}
                    onChange={(v) => setParam("department_id", v)}
                    options={[
                      { value: "", label: "All departments" },
                      ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    placeholder="All departments"
                    compact
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Status</label>
                  <NeuSelect
                    value={statusId ?? ""}
                    onChange={(v) => setParam("status_id", v)}
                    options={[
                      { value: "", label: "All statuses" },
                      ...(statuses ?? []).map((s) => ({ value: s.id, label: s.label })),
                    ]}
                    placeholder="All statuses"
                    compact
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Priority</label>
                  <NeuSelect
                    value={priorityId ?? ""}
                    onChange={(v) => setParam("priority_id", v)}
                    options={[
                      { value: "", label: "All priorities" },
                      ...(priorities ?? []).map((p) => ({ value: p.id, label: p.label })),
                    ]}
                    placeholder="All priorities"
                    compact
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Assignee</label>
                  <NeuSelect
                    value={assigneeIds ?? ""}
                    onChange={(v) => setParam("assignee_id", v)}
                    options={[
                      { value: "", label: "All assignees" },
                      ...((members as any[]) ?? []).map((m: any) => ({ value: m.id, label: m.full_name })),
                    ]}
                    placeholder="All assignees"
                    compact
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button type="button" onClick={() => { setParams({}); setFilterOpen(false); }} className="btn-ghost text-xs gap-1 w-full justify-center">
                  <X className="h-3 w-3" /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {(hasDrillFilters || searchQuery) && (
          <button type="button" onClick={() => setParams({})} className="btn-ghost !py-2 !px-3 text-xs gap-1 shrink-0">
            <X className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="neu-card !p-0 overflow-hidden">
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
              className="btn-danger !py-1.5 !px-3 !text-xs gap-1"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
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
