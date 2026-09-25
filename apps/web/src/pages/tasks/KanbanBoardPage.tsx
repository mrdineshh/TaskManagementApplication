import { useState } from "react";
import { Link } from "react-router-dom";
import { Kanban, ListTodo, Calendar, Construction, Plus, ArrowRight } from "lucide-react";
import { useDepartments } from "../../features/tasks/hooks";
import { NewTaskForm } from "../../features/tasks/NewTaskForm";
import { NeuSelect } from "../../components/NeuSelect";
import { usePermission } from "../../lib/permissions/usePermission";

/** Kanban board - temporarily disabled; provides maintenance notice and navigation links. */
export function KanbanBoardPage() {
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState("");
  const [showNewTask, setShowNewTask]   = useState(false);
  const canCreate = usePermission("task.create");

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-box-brand">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Kanban Board</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Visual workflow and status board</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <NeuSelect
            value={departmentId}
            onChange={setDepartmentId}
            options={[
              { value: "", label: "All departments" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            placeholder="All departments"
            compact
            style={{ minWidth: "11rem" }}
          />

          {canCreate && (
            <button onClick={() => setShowNewTask((v) => !v)} className="btn-primary gap-1.5">
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}

          <Link to="/tasks" className="btn-neu gap-1.5 text-sm">
            <ListTodo className="w-4 h-4" style={{ color: "#2563EB" }} />
            List View
          </Link>
        </div>
      </div>

      {showNewTask && (
        <div className="animate-pop-in">
          <NewTaskForm onDone={() => setShowNewTask(false)} />
        </div>
      )}

      {/* Maintenance notice */}
      <div
        className="neu-card flex flex-col items-center text-center py-14"
        style={{ borderLeft: "4px solid #f59e0b" }}
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5 animate-float"
          style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
        >
          <Construction className="w-8 h-8" />
        </div>

        <h2 className="text-xl mb-2 font-bold" style={{ color: "var(--text-primary)" }}>
          Kanban Board Temporarily Disabled
        </h2>
        <p className="max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
          The interactive drag-and-drop Kanban board is temporarily under maintenance.
          You can manage, view, edit, and transition all tasks from List View or Timeline View.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/tasks" className="btn-primary gap-2">
            <ListTodo className="h-4 w-4" />
            Go to List View
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/tasks/timeline" className="btn-neu gap-2 text-sm">
            <Calendar className="h-4 w-4" style={{ color: "#2563EB" }} />
            Timeline View
          </Link>
        </div>
      </div>
    </div>
  );
}
