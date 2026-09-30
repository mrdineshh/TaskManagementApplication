import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTask, useDepartments, usePriorities, useUsers } from './hooks';
import { apiClient } from '../../lib/api-client/client';
import { Calendar } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { NeuSelect } from '../../components/NeuSelect';
import { NeuDatePicker } from '../../components/NeuDatePicker';
import { useSessionStore } from '../../lib/auth/session-store';
import { usePermission } from '../../lib/permissions/usePermission';

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { data: departments } = useDepartments();
  const currentUser = useSessionStore((s) => s.currentUser);
  const canDelete = usePermission('task.delete');
  const canManageUsers = usePermission('user.manage');
  const isManagerOrAdmin = canDelete || canManageUsers || currentUser?.roles?.some((r: any) => r.name === 'Admin' || r.name === 'Manager' || r.name === 'Head');

  const defaultDeptId = (currentUser as any)?.primary_department_id ?? '';
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDeptId);
  const [priorityId, setPriorityId] = useState('');
  const [assigneeId, setAssigneeId] = useState(isManagerOrAdmin ? '' : (currentUser?.id ?? ''));
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimateValue, setEstimateValue] = useState('');
  const [estimateUnit, setEstimateUnit] = useState<'hours' | 'days'>('hours');
  const { data: priorities } = usePriorities(departmentId || undefined);
  // fetchAll=true for managers/admins so they see all team members (not restricted to department).
  const { data: members } = useUsers(departmentId || undefined, isManagerOrAdmin);
  const createTask = useCreateTask();
  const navigate = useNavigate();

  const userDeptIds: string[] = useMemo(() => {
    return (currentUser as any)?.department_ids?.length
      ? (currentUser as any).department_ids
      : (currentUser as any)?.primary_department_id
        ? [(currentUser as any).primary_department_id]
        : [];
  }, [currentUser]);

  const availableDepartments = useMemo(() => {
    return (departments ?? []).filter((d) =>
      isManagerOrAdmin ? true : userDeptIds.length > 0 ? userDeptIds.includes(d.id) : true,
    );
  }, [departments, isManagerOrAdmin, userDeptIds]);

  useEffect(() => {
    if (!departmentId && defaultDeptId) {
      setDepartmentId(defaultDeptId);
    } else if (!departmentId && availableDepartments.length === 1) {
      setDepartmentId(availableDepartments[0].id);
    }
    if (!assigneeId && !isManagerOrAdmin && currentUser?.id) {
      setAssigneeId(currentUser.id);
    }
  }, [defaultDeptId, currentUser?.id, isManagerOrAdmin, departmentId, availableDepartments]);

  function handleDepartmentChange(id: string) {
    setDepartmentId(id);
    if (isManagerOrAdmin) {
      setAssigneeId(''); // last department's member likely isn't in the new one
    } else {
      setAssigneeId(currentUser?.id ?? '');
    }
  }

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const durationDays = useMemo(() => {
    if (!startDate || !dueDate) return 1;
    const start = new Date(startDate).getTime();
    const end = new Date(dueDate).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return 1;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [startDate, dueDate]);

  function handleStartDateChange(val: string) {
    setStartDate(val);
    if (dueDate && val && dueDate < val) {
      setDueDate(val);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !departmentId) return;

    const parsedHours = parseFloat(estimateValue);
    const estVal = estimateUnit === 'hours' ? parsedHours : durationDays;

    // Regular employees creating their own tasks must provide Start Date, Due Date, and Estimate
    if (!isManagerOrAdmin) {
      if (!startDate) {
        alert('Please specify a Start Date.');
        return;
      }
      if (!dueDate) {
        alert('Please specify a Due Date.');
        return;
      }
      if (estimateUnit === 'hours' && (!estimateValue || isNaN(parsedHours) || parsedHours <= 0)) {
        alert('Please specify expected hours per day.');
        return;
      }
    }

    const finalEstVal = estimateUnit === 'hours'
      ? (!isNaN(parsedHours) && parsedHours > 0 ? parsedHours : undefined)
      : durationDays;

    const task = await createTask.mutateAsync({
      title,
      department_id: departmentId,
      priority_id: priorityId || undefined,
      assignee_id: assigneeId || undefined,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      estimate_value: finalEstVal,
      estimate_unit: estimateUnit,
    });
    const taskId = (task as { id: string }).id;
    if (finalEstVal && finalEstVal > 0) {
      await apiClient.tasks.submitEstimate(taskId, finalEstVal, estimateUnit).catch(() => {});
    }
    onDone();
    navigate(`/tasks/${taskId}`);
  }

  const deptOptions = [
    { value: '', label: 'Department…' },
    ...availableDepartments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const assigneeOptions = isManagerOrAdmin
    ? [
        { value: '', label: 'Unassigned' },
        ...((members as { id: string; full_name: string }[] | undefined) ?? []).map((m) => ({
          value: m.id,
          label: m.full_name,
        })),
      ]
    : [
        { value: currentUser?.id ?? '', label: currentUser?.full_name ? `Assigned to me (${currentUser.full_name})` : 'Assign to me' },
        { value: '', label: 'Unassigned' },
      ];

  const priorityOptions = [
    { value: '', label: 'Priority (default)' },
    ...(priorities ?? []).map((p) => ({ value: p.id, label: p.label })),
  ];

  const parsedEst = parseFloat(estimateValue) || 0;
  const totalHoursCalculated = estimateUnit === 'hours' ? (parsedEst * durationDays).toFixed(1) : (durationDays * 6).toFixed(0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 neu-card !p-5">
      <div>
        <label className="block text-[10px] uppercase font-bold mb-1 text-slate-700 dark:text-slate-300 tracking-wider">
          Task Title <span className="text-red-500">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Implement client CRM integration"
          className="w-full neu-input text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>
            Department <span className="text-red-500">*</span>
          </label>
          <NeuSelect
            value={departmentId}
            onChange={handleDepartmentChange}
            options={deptOptions}
            placeholder="Department…"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Assignee</label>
          <NeuSelect
            value={assigneeId}
            onChange={setAssigneeId}
            options={assigneeOptions}
            placeholder="Assignee…"
            disabled={!departmentId}
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>Priority</label>
          <NeuSelect
            value={priorityId}
            onChange={setPriorityId}
            options={priorityOptions}
            placeholder="Priority (default)"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>
            Start Date {!isManagerOrAdmin && <span className="text-red-500">*</span>}
          </label>
          <NeuDatePicker
            value={startDate}
            min={todayStr}
            onChange={handleStartDateChange}
            placeholder="Start date"
            compact
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--text-faint)" }}>
            Due Date {!isManagerOrAdmin && <span className="text-red-500">*</span>}
          </label>
          <NeuDatePicker
            value={dueDate}
            min={startDate || todayStr}
            onChange={setDueDate}
            placeholder="Due date"
            compact
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Effort Estimation & Daily Timer Allocation */}
      <div className="rounded-xl border-2 border-amber-500/80 bg-white dark:bg-slate-900 p-4 shadow-neu-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Time Estimation &amp; Daily Work Allocation {!isManagerOrAdmin && <span className="text-red-500">*</span>}
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isManagerOrAdmin
                ? 'Specify expected effort, or allow assignee to scope it before starting work.'
                : 'Required: Define your daily work budget. The timer will run up to this daily limit and automatically pause.'}
            </p>
          </div>
          {startDate && dueDate && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 shadow-2xs shrink-0">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Duration: {durationDays} day{durationDays > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Unit Toggle Pill Group with curved blue border on active item */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-1 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setEstimateUnit('hours')}
              className={`rounded-lg px-3.5 py-1.5 transition-all text-xs font-semibold ${
                estimateUnit === 'hours'
                  ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'border-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Hours / Day
            </button>
            <button
              type="button"
              onClick={() => setEstimateUnit('days')}
              className={`rounded-lg px-3.5 py-1.5 transition-all text-xs font-semibold ${
                estimateUnit === 'days'
                  ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'border-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Days
            </button>
          </div>

          {/* Input field only shown for Hours / Day */}
          {estimateUnit === 'hours' && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0.25"
                max="24"
                step="any"
                value={estimateValue}
                onChange={(e) => setEstimateValue(e.target.value)}
                placeholder="e.g. 6"
                className="w-20 neu-input text-sm font-semibold rounded-lg text-center"
                required={!isManagerOrAdmin}
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">hrs / day</span>
            </div>
          )}

          {/* Live allocation preview */}
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-slate-700 flex-1 min-w-[240px]">
            {estimateUnit === 'hours' ? (
              parsedEst > 0 ? (
                <span>
                  ⏱️ <strong>{durationDays} day{durationDays > 1 ? 's' : ''}</strong> × <strong>{parsedEst} hrs/day</strong> = <strong>{totalHoursCalculated} total hrs</strong> budget. <em>Timer runs {parsedEst}h daily and automatically pauses.</em>
                </span>
              ) : (
                <span className="text-slate-400">Enter daily hours (e.g. 6) — timer will automatically pause after {estimateValue || 6} hours each day.</span>
              )
            ) : (
              <span>
                ⏱️ <strong>{durationDays} day{durationDays > 1 ? 's' : ''} allocated</strong>. <em>Standard daily timer runs up to 6 hours/day and automatically pauses. Total budget: {totalHoursCalculated}h.</em>
              </span>
            )}
          </div>
        </div>
      </div>

      {createTask.isError && <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{(createTask.error as Error).message}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={
            createTask.isPending ||
            (!isManagerOrAdmin && (!startDate || !dueDate || (estimateUnit === 'hours' && (!estimateValue || parseFloat(estimateValue) <= 0))))
          }
          className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-900 dark:text-slate-100 px-5 py-2 text-sm font-bold shadow-2xs transition-all disabled:opacity-50"
        >
          {createTask.isPending && <Spinner className="h-4 w-4" />}
          {createTask.isPending ? 'Creating…' : 'Create Task'}
        </button>
        {!isManagerOrAdmin && (!startDate || !dueDate || (estimateUnit === 'hours' && !estimateValue)) && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            * Start Date, Due Date, and Effort Estimate are required to create this task.
          </span>
        )}
      </div>
    </form>
  );
}
