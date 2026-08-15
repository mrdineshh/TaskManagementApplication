import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.service';
import { assertDepartmentScope, departmentScopeWhere } from '../common/scope.util';
import { decodeCursor, encodeCursor } from '../common/cursor-pagination.util';
import { isOverdueOnBusinessDay } from '../common/business-days.util';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto/task.dto';

interface Cursor {
  id: string;
  sortValue: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly holidayCalendars: HolidayCalendarsService,
  ) {}

  async list(user: AccessTokenPayload, query: TaskListQueryDto) {
    const limit = Math.min(query.limit ?? 25, 100);
    const sortField = (query.sort ?? '-created_at').replace(/^-/, '');
    const descending = (query.sort ?? '-created_at').startsWith('-');
    const fieldMap: Record<string, keyof Prisma.TaskOrderByWithRelationInput> = {
      due_date: 'dueDate',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      title: 'title',
    };
    const orderField = fieldMap[sortField] ?? 'createdAt';

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...departmentScopeWhere(user),
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.status_id ? { statusId: query.status_id } : {}),
      ...(query.assignee_id?.length ? { assigneeId: { in: query.assignee_id } } : {}),
      ...(query.priority_id ? { priorityId: query.priority_id } : {}),
      ...(query.parent_task_id !== undefined ? { parentTaskId: query.parent_task_id } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    // Drill-down from a dashboard's "Overdue"/"Over budget" stat (docs/10-OPEN-DECISIONS.md
    // §M5) — same live definition dashboards.controller.ts's computeTaskStats() uses (open
    // tasks only, business-day-overdue as of now / logged minutes over the estimate). Computed
    // in-memory per task's own assignee holiday calendar, so this path skips cursor pagination
    // in favor of one bounded fetch — dashboard-scoped task lists (a department/team) are small
    // enough that this is simpler and more honest than a DB predicate that can't express it.
    if (query.overdue || query.over_budget) {
      return this.listByComputedFilter(where, query, limit);
    }

    const cursor = decodeCursor<Cursor>(query.cursor);
    if (cursor) {
      (where as Record<string, unknown>).id = descending ? { lt: cursor.id } : { gt: cursor.id };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ [orderField]: descending ? 'desc' : 'asc' }, { id: descending ? 'desc' : 'asc' }],
      take: limit + 1,
      include: {
        status: true,
        priority: true,
        assignee: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const hasMore = tasks.length > limit;
    const page = tasks.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page,
      next_cursor: hasMore && last ? encodeCursor({ id: last.id, sortValue: String(last[orderField as keyof typeof last]) }) : null,
    };
  }

  private async listByComputedFilter(where: Prisma.TaskWhereInput, query: TaskListQueryDto, limit: number) {
    const candidates = await this.prisma.task.findMany({
      where: { ...where, status: { category: { in: ['todo', 'in_progress'] } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 500,
      include: {
        status: true,
        priority: true,
        assignee: { select: { id: true, fullName: true, email: true, workCountry: true, workState: true } },
        department: { select: { id: true, name: true } },
        timeLogs: { select: { minutes: true } },
      },
    });

    const now = new Date();
    const holidayCache = new Map<string, ReadonlySet<string>>();
    const matches: typeof candidates = [];

    for (const task of candidates) {
      let isOverdue = false;
      if (task.dueDate && task.assignee) {
        const regionKey = `${task.assignee.workCountry}::${task.assignee.workState}`;
        if (!holidayCache.has(regionKey)) {
          holidayCache.set(regionKey, await this.holidayCalendars.getHolidayDateKeys(task.assignee.workCountry, task.assignee.workState));
        }
        isOverdue = isOverdueOnBusinessDay(task.dueDate, now, holidayCache.get(regionKey)!);
      }

      let isOverBudget = false;
      if (task.estimateValue !== null && task.estimateUnit !== null) {
        const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
        const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
        isOverBudget = loggedMinutes > estimateMinutes;
      }

      // Combines like every other filter on this endpoint (AND, narrowing further) — matters
      // only if a caller passes both at once, which the UI never does today.
      if ((!query.overdue || isOverdue) && (!query.over_budget || isOverBudget)) {
        matches.push(task);
      }
    }

    return { items: matches.slice(0, limit), next_cursor: null };
  }

  async get(user: AccessTokenPayload, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        customFieldValues: true,
        subtasks: { where: { deletedAt: null }, include: { status: true } },
        status: true,
        priority: true,
        assignee: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId);
    return task;
  }

  async create(user: AccessTokenPayload, dto: CreateTaskDto) {
    assertDepartmentScope(user, dto.department_id);

    const workflow = dto.workflow_id
      ? await this.prisma.workflowDefinition.findUniqueOrThrow({ where: { id: dto.workflow_id } })
      : await this.resolveDefaultWorkflow(dto.department_id);

    const initialStatus = await this.prisma.workflowStatus.findFirst({
      where: { workflowId: workflow.id },
      orderBy: { displayOrder: 'asc' },
    });
    if (!initialStatus) {
      throw new BadRequestException('Workflow has no statuses defined');
    }

    const priority = dto.priority_id
      ? await this.prisma.priorityDefinition.findUniqueOrThrow({ where: { id: dto.priority_id } })
      : await this.resolveDefaultPriority(dto.department_id);

    if (dto.parent_task_id) {
      const parent = await this.prisma.task.findUnique({ where: { id: dto.parent_task_id } });
      if (!parent) throw new BadRequestException('parent_task_id does not reference an existing task');
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        departmentId: dto.department_id,
        workflowId: workflow.id,
        statusId: initialStatus.id,
        priorityId: priority.id,
        assigneeId: dto.assignee_id ?? null,
        createdById: user.sub,
        parentTaskId: dto.parent_task_id ?? null,
        dueDate: dto.due_date ? new Date(dto.due_date) : null,
        startDate: dto.start_date ? new Date(dto.start_date) : null,
        isRecurring: dto.is_recurring ?? false,
        recurrenceRule: dto.is_recurring ? dto.recurrence_rule : null,
        slaPolicyId: dto.sla_policy_id ?? null,
      },
    });

    if (dto.custom_field_values) {
      await this.upsertCustomFieldValues(task.id, dto.department_id, dto.custom_field_values);
    }

    await this.logActivity(task.id, user.sub, 'created', {});

    if (task.assigneeId) {
      await this.notifications.notify(task.assigneeId, 'task_assigned', { taskId: task.id, taskTitle: task.title });
    }

    return this.get(user, task.id);
  }

  async update(user: AccessTokenPayload, id: string, dto: UpdateTaskDto) {
    const existing = await this.get(user, id);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priorityId: dto.priority_id,
        dueDate: dto.due_date === undefined ? undefined : dto.due_date ? new Date(dto.due_date) : null,
        startDate: dto.start_date === undefined ? undefined : dto.start_date ? new Date(dto.start_date) : null,
        slaPolicyId: dto.sla_policy_id === undefined ? undefined : dto.sla_policy_id,
      },
    });

    if (dto.custom_field_values) {
      await this.upsertCustomFieldValues(id, existing.departmentId, dto.custom_field_values);
    }

    await this.logActivity(id, user.sub, 'field_updated', { fields: Object.keys(dto) });
    return this.get(user, task.id);
  }

  async remove(user: AccessTokenPayload, id: string) {
    const existing = await this.get(user, id);
    await this.prisma.task.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await this.logActivity(id, user.sub, 'deleted', {});
    return { success: true };
  }

  async assign(user: AccessTokenPayload, id: string, assigneeId: string | null) {
    const existing = await this.get(user, id);
    const previousAssigneeId = existing.assigneeId;

    const task = await this.prisma.task.update({ where: { id }, data: { assigneeId } });
    await this.logActivity(id, user.sub, 'reassigned', { from: previousAssigneeId, to: assigneeId });

    if (previousAssigneeId) {
      await this.notifications.notify(previousAssigneeId, 'task_reassigned', { taskId: id, taskTitle: task.title });
    }
    if (assigneeId) {
      await this.notifications.notify(assigneeId, 'task_assigned', { taskId: id, taskTitle: task.title });
    }
    return task;
  }

  /**
   * Validates and applies a WorkflowTransition (docs/03-RBAC-AUTH.md §2.3, 04-API-SPEC.md §5).
   * Two v1.1 behaviors layer on top of the v1 logic:
   *  - requires_approval transitions create a pending ApprovalStep instead of changing status
   *    immediately (docs/05-FEATURES.md §2.5), returned as { pending_approval: true, ... }.
   *  - moving into a 'done'-category status with open 'blocks' dependencies is a *soft warning*
   *    per docs/10-OPEN-DECISIONS.md B2 — the transition still succeeds, but the response
   *    includes `warnings.open_blockers` for the UI to surface.
   */
  async transition(user: AccessTokenPayload, id: string, toStatusId: string, onHoldReasonId?: string) {
    const existing = await this.get(user, id);

    const transition = await this.prisma.workflowTransition.findFirst({
      where: { workflowId: existing.workflowId, fromStatusId: existing.statusId, toStatusId },
    });
    if (!transition) {
      throw new BadRequestException('No such transition is allowed from the task\'s current status');
    }
    if (transition.requiredPermission && !user.permissions.includes(transition.requiredPermission)) {
      throw new ForbiddenException(`Transition requires permission: ${transition.requiredPermission}`);
    }

    const toStatus = await this.prisma.workflowStatus.findUniqueOrThrow({ where: { id: toStatusId } });

    // On-Hold reason (docs/10-OPEN-DECISIONS.md §H1) — required entering any status an Admin
    // has flagged, cleared automatically leaving one (applyStatusChange below).
    if (toStatus.requiresHoldReason) {
      if (!onHoldReasonId) {
        throw new BadRequestException('This status requires selecting a reason.');
      }
      const reason = await this.prisma.onHoldReason.findUnique({ where: { id: onHoldReasonId } });
      if (!reason || !reason.isActive) {
        throw new BadRequestException('on_hold_reason_id does not reference an active, existing reason');
      }
    }

    // Effort estimate gate (§H2) — mandatory before work starts, set by the assignee via
    // POST /tasks/:id/estimate, never by this endpoint. Gated on requiresEstimateBeforeEntry,
    // NOT category === 'in_progress' — that category also covers On Hold/Blocked/In Review,
    // none of which should demand a fresh estimate (hit live: pausing an un-started task via
    // On Hold was incorrectly blocked by a category-based check).
    if (toStatus.requiresEstimateBeforeEntry && existing.estimateValue === null) {
      throw new BadRequestException('An effort estimate is required before starting work on this task.');
    }

    // Hard block on open subtasks — unlike getOpenBlockers()'s soft warning for task
    // dependencies below, this is a hard rule the user was explicit about: a parent cannot
    // close while any subtask is still open. Single level only (no discussion of nested
    // subtasks-of-subtasks).
    if (toStatus.category === 'done') {
      const openSubtasks = existing.subtasks.filter((s) => s.status.category !== 'done');
      if (openSubtasks.length > 0) {
        throw new BadRequestException(
          `Cannot complete this task while ${openSubtasks.length} subtask(s) are still open.`,
        );
      }
    }

    if (transition.requiresApproval) {
      const step = await this.prisma.approvalStep.create({
        data: { taskId: id, transitionId: transition.id, stepOrder: 1 },
      });
      await this.logActivity(id, user.sub, 'approval_requested', { transitionId: transition.id, approvalStepId: step.id });
      await this.notifyApprovers(existing.departmentId, id, existing.title);
      return { pending_approval: true, approval_step: step };
    }

    const openBlockers = await this.getOpenBlockers(id, toStatusId);
    const task = await this.applyStatusChange(id, toStatusId, user.sub, onHoldReasonId);
    return { ...task, warnings: openBlockers.length ? { open_blockers: openBlockers } : undefined };
  }

  /**
   * Shared by transition() and the approval-decide path — actually moves the task to a new
   * status. onHoldReasonId is only meaningful when called from transition(); the
   * approval-decide call site doesn't thread it through (an approval-gated transition into a
   * hold-reason-required status is an untested edge case — not discussed, and rare enough not
   * to build out further here, logged in docs/10-OPEN-DECISIONS.md §H1).
   */
  private async applyStatusChange(id: string, toStatusId: string, actorId: string, onHoldReasonId?: string) {
    const before = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    const toStatus = await this.prisma.workflowStatus.findUniqueOrThrow({ where: { id: toStatusId } });
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        statusId: toStatusId,
        completedAt: toStatus.category === 'done' ? new Date() : null,
        onHoldReasonId: toStatus.requiresHoldReason ? onHoldReasonId : null,
      },
    });

    await this.logActivity(id, actorId, 'status_changed', { from: before.statusId, to: toStatusId });

    if (task.assigneeId) {
      await this.notifications.notify(task.assigneeId, 'status_changed', { taskId: id, taskTitle: task.title });
    }

    if (toStatus.requiresHoldReason) {
      await this.notifications.notify(task.createdById, 'task_on_hold', { taskId: id, taskTitle: task.title });
    }

    if (toStatus.category === 'done' && task.isRecurring && task.recurrenceRule) {
      await this.generateNextOccurrence(task);
    }

    return task;
  }

  // --- Phase 2: effort estimation (docs/10-OPEN-DECISIONS.md §H2) ---

  async submitEstimate(user: AccessTokenPayload, taskId: string, value: number, unit: 'hours' | 'days') {
    const task = await this.get(user, taskId);

    const isOverride = user.permissions.includes('task.override_locked_edits');
    if (task.estimateValue !== null) {
      const withinWindow =
        task.estimateSubmittedAt !== null && Date.now() - task.estimateSubmittedAt.getTime() <= 30 * 60 * 1000;
      const isOriginalSubmitter = task.estimateSubmittedById === user.sub;
      if (!isOverride && !isOriginalSubmitter) {
        throw new ForbiddenException('Only the person who submitted this estimate can change it — ask an Admin.');
      }
      if (!isOverride && !withinWindow) {
        throw new ForbiddenException('This estimate is locked (more than 30 minutes old) — ask an Admin to change it.');
      }
    } else if (!isOverride && task.assigneeId !== user.sub) {
      throw new ForbiddenException('Only the assignee can submit an effort estimate for this task.');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        estimateValue: value,
        estimateUnit: unit,
        estimateSubmittedAt: new Date(),
        estimateSubmittedById: user.sub,
      },
    });
    // Logged even for the submitter's own edit within the window, not just Admin overrides —
    // the user was explicit: "we will log the change even the admin does it."
    await this.logActivity(taskId, user.sub, 'estimate_submitted', {
      previousValue: task.estimateValue,
      previousUnit: task.estimateUnit,
      value,
      unit,
      isOverride: isOverride && !(task.estimateSubmittedById === user.sub),
    });
    return updated;
  }

  /** Soft-warning dependency check (docs/10-OPEN-DECISIONS.md B2) — only relevant moving into 'done'. */
  private async getOpenBlockers(taskId: string, toStatusId: string) {
    const toStatus = await this.prisma.workflowStatus.findUnique({ where: { id: toStatusId } });
    if (toStatus?.category !== 'done') return [];

    const blockers = await this.prisma.taskDependency.findMany({
      where: { taskId, type: 'blocks' },
      include: { dependsOnTask: { include: { status: true } } },
    });
    return blockers
      .filter((b) => b.dependsOnTask.status.category !== 'done' && b.dependsOnTask.deletedAt === null)
      .map((b) => ({ task_id: b.dependsOnTask.id, task_title: b.dependsOnTask.title }));
  }

  // --- v1.1: Time tracking (docs/05-FEATURES.md §2.1 — optional everywhere, per B1 default) ---

  async listTimeLogs(user: AccessTokenPayload, taskId: string) {
    await this.get(user, taskId);
    return this.prisma.timeLog.findMany({ where: { taskId }, orderBy: { loggedAt: 'desc' } });
  }

  async addTimeLog(user: AccessTokenPayload, taskId: string, minutes: number, note?: string, loggedAt?: string) {
    const task = await this.get(user, taskId);
    const totalBefore = await this.sumTimeLogMinutes(taskId);

    const log = await this.prisma.timeLog.create({
      data: { taskId, userId: user.sub, minutes, note, loggedAt: loggedAt ? new Date(loggedAt) : undefined },
    });
    await this.logActivity(taskId, user.sub, 'time_logged', { minutes, timeLogId: log.id });
    await this.notifyIfEffortBudgetCrossed(task, totalBefore, totalBefore + minutes);
    return log;
  }

  /**
   * Same 30-minute self-edit window + Admin override as submitEstimate() above
   * (docs/10-OPEN-DECISIONS.md §H3) — the window is measured from createdAt (when the entry
   * was made), not loggedAt (which date the work happened on; can be backdated).
   */
  async updateTimeLog(
    user: AccessTokenPayload,
    taskId: string,
    logId: string,
    data: { minutes?: number; note?: string; loggedAt?: string },
  ) {
    const task = await this.get(user, taskId);
    const log = await this.prisma.timeLog.findUnique({ where: { id: logId } });
    if (!log || log.taskId !== taskId) throw new NotFoundException('Time log entry not found');

    const isOverride = user.permissions.includes('task.override_locked_edits');
    const withinWindow = Date.now() - log.createdAt.getTime() <= 30 * 60 * 1000;
    const isOriginalLogger = log.userId === user.sub;
    if (!isOverride && !isOriginalLogger) {
      throw new ForbiddenException('Only the person who logged this entry can change it — ask an Admin.');
    }
    if (!isOverride && !withinWindow) {
      throw new ForbiddenException('This time log entry is locked (more than 30 minutes old) — ask an Admin to change it.');
    }

    const totalBefore = await this.sumTimeLogMinutes(taskId);
    const updated = await this.prisma.timeLog.update({
      where: { id: logId },
      data: {
        minutes: data.minutes,
        note: data.note,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : undefined,
      },
    });
    await this.logActivity(taskId, user.sub, 'time_log_updated', {
      timeLogId: logId,
      previousMinutes: log.minutes,
      minutes: updated.minutes,
      isOverride: isOverride && !isOriginalLogger,
    });

    const totalAfter = totalBefore - log.minutes + updated.minutes;
    await this.notifyIfEffortBudgetCrossed(task, totalBefore, totalAfter);
    return updated;
  }

  private async sumTimeLogMinutes(taskId: string): Promise<number> {
    const agg = await this.prisma.timeLog.aggregate({ where: { taskId }, _sum: { minutes: true } });
    return agg._sum.minutes ?? 0;
  }

  /**
   * Fires once, the moment logged effort first crosses the estimate (docs/10-OPEN-DECISIONS.md
   * §H3) — comparing totalBefore/totalAfter against the threshold, not just "is it over now",
   * so re-logging more time after already crossing doesn't notify again and again.
   */
  private async notifyIfEffortBudgetCrossed(
    task: { id: string; title: string; assigneeId: string | null; estimateValue: number | null; estimateUnit: string | null },
    totalBefore: number,
    totalAfter: number,
  ) {
    if (task.estimateValue === null || task.estimateUnit === null || !task.assigneeId) return;
    const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
    if (totalBefore <= estimateMinutes && totalAfter > estimateMinutes) {
      await this.notifications.notify(task.assigneeId, 'effort_budget_exceeded', {
        taskId: task.id,
        taskTitle: task.title,
        estimateMinutes,
        loggedMinutes: totalAfter,
      });
    }
  }

  // --- v1.1: Task dependencies (docs/02-DATA-MODEL.md §3) ---

  async listDependencies(user: AccessTokenPayload, taskId: string) {
    await this.get(user, taskId);
    return this.prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOnTask: { select: { id: true, title: true } } },
    });
  }

  async addDependency(user: AccessTokenPayload, taskId: string, dependsOnTaskId: string, type: 'blocks' | 'relates_to') {
    await this.get(user, taskId);
    await this.get(user, dependsOnTaskId); // 404s if the target task doesn't exist or is out of scope
    if (taskId === dependsOnTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
    const dependency = await this.prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId, type },
    });
    await this.logActivity(taskId, user.sub, 'dependency_added', { dependsOnTaskId, type });
    return dependency;
  }

  async removeDependency(user: AccessTokenPayload, taskId: string, dependencyId: string) {
    await this.get(user, taskId);
    await this.prisma.taskDependency.delete({ where: { id: dependencyId } });
    await this.logActivity(taskId, user.sub, 'dependency_removed', { dependencyId });
    return { success: true };
  }

  // --- v1.1: Approval workflows (docs/05-FEATURES.md §2.5) ---

  async listApprovalSteps(user: AccessTokenPayload, taskId: string) {
    await this.get(user, taskId);
    return this.prisma.approvalStep.findMany({ where: { taskId }, orderBy: { stepOrder: 'asc' } });
  }

  /**
   * Approve/reject a pending step. Anyone holding `approval.approve` within the task's
   * department scope can decide it (single-step chains for v1.1 — see ApprovalStep.stepOrder
   * for where multi-step sequencing would extend this; not built out further yet since the
   * doc doesn't specify how approver assignment per step should work beyond "configured by
   * Admins per workflow").
   */
  async decideApprovalStep(user: AccessTokenPayload, approvalStepId: string, decision: 'approved' | 'rejected', comment?: string) {
    if (!user.permissions.includes('approval.approve')) {
      throw new ForbiddenException('Missing required permission: approval.approve');
    }
    const step = await this.prisma.approvalStep.findUnique({
      where: { id: approvalStepId },
      include: { task: true, transition: true },
    });
    if (!step) throw new NotFoundException('Approval step not found');
    if (step.status !== 'pending') {
      throw new BadRequestException('This approval step has already been decided');
    }
    assertDepartmentScope(user, step.task.departmentId);

    const updated = await this.prisma.approvalStep.update({
      where: { id: approvalStepId },
      data: { status: decision, approverId: user.sub, comment, decidedAt: new Date() },
    });
    await this.logActivity(step.taskId, user.sub, 'approval_decided', { approvalStepId, decision });

    if (decision === 'approved') {
      await this.applyStatusChange(step.taskId, step.transition.toStatusId, user.sub);
    } else if (step.task.assigneeId) {
      await this.notifications.notify(step.task.assigneeId, 'status_changed', {
        taskId: step.taskId,
        taskTitle: step.task.title,
        approvalRejected: true,
      });
    }
    return updated;
  }

  private async notifyApprovers(departmentId: string, taskId: string, taskTitle: string) {
    const candidates = await this.prisma.userRole.findMany({
      where: { role: { permissions: { some: { permission: { key: 'approval.approve' } } } } },
      include: { role: true },
    });
    const approverIds = new Set(
      candidates
        .filter((ur) => ur.role.departmentId === null || ur.role.departmentId === departmentId || ur.departmentOverride === departmentId)
        .map((ur) => ur.userId),
    );
    for (const userId of approverIds) {
      await this.notifications.notify(userId, 'approval_requested', { taskId, taskTitle });
    }
  }

  // --- v1.1: Recurring tasks (docs/05-FEATURES.md §2.4) ---

  /** Generates the next occurrence per the task's iCal RRULE when the current one completes. */
  private async generateNextOccurrence(task: {
    id: string;
    title: string;
    description: string | null;
    departmentId: string;
    workflowId: string;
    priorityId: string;
    assigneeId: string | null;
    createdById: string;
    dueDate: Date | null;
    startDate: Date | null;
    recurrenceRule: string | null;
  }) {
    const { RRule } = await import('rrule');
    if (!task.recurrenceRule) return;

    // Accept a bare "FREQ=..." string (what the admin UI stores) as well as a full
    // "RRULE:FREQ=..." string — RRule.fromString requires the "RRULE:" prefix.
    const ruleString = task.recurrenceRule.trim().toUpperCase().startsWith('RRULE:')
      ? task.recurrenceRule
      : `RRULE:${task.recurrenceRule}`;

    const anchor = task.dueDate ?? task.startDate ?? new Date();

    let rule: InstanceType<typeof RRule>;
    try {
      const parsed = RRule.fromString(ruleString);
      // RRule.fromString defaults dtstart to "now" when the rule string has none, which
      // anchors the whole recurrence sequence to whenever this code happens to run rather
      // than to the task's actual schedule — rebuild with dtstart pinned to the task's own
      // due/start date so `.after(anchor)` walks forward from the right starting point.
      rule = new RRule({ ...parsed.origOptions, dtstart: anchor });
    } catch {
      return; // malformed rule — skip rather than fail the status transition it's attached to
    }

    const next = rule.after(anchor, false);
    if (!next) return; // rule has no further occurrences

    const workflow = await this.prisma.workflowDefinition.findUniqueOrThrow({ where: { id: task.workflowId } });
    const initialStatus = await this.prisma.workflowStatus.findFirst({
      where: { workflowId: workflow.id },
      orderBy: { displayOrder: 'asc' },
    });
    if (!initialStatus) return;

    const offsetMs = task.dueDate && task.startDate ? task.dueDate.getTime() - task.startDate.getTime() : null;

    const newTask = await this.prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        departmentId: task.departmentId,
        workflowId: task.workflowId,
        statusId: initialStatus.id,
        priorityId: task.priorityId,
        assigneeId: task.assigneeId,
        createdById: task.createdById,
        dueDate: next,
        startDate: offsetMs !== null ? new Date(next.getTime() - offsetMs) : null,
        isRecurring: true,
        recurrenceRule: task.recurrenceRule,
      },
    });
    await this.logActivity(newTask.id, task.createdById, 'created', { recurrenceOf: task.id });
    if (newTask.assigneeId) {
      await this.notifications.notify(newTask.assigneeId, 'task_assigned', { taskId: newTask.id, taskTitle: newTask.title });
    }
  }

  async activity(user: AccessTokenPayload, id: string) {
    await this.get(user, id);
    return this.prisma.activityLogEntry.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listComments(user: AccessTokenPayload, id: string) {
    await this.get(user, id);
    return this.prisma.taskComment.findMany({
      where: { taskId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(user: AccessTokenPayload, id: string, body: string) {
    const task = await this.get(user, id);
    const comment = await this.prisma.taskComment.create({
      data: { taskId: id, authorId: user.sub, body },
    });
    await this.logActivity(id, user.sub, 'commented', { commentId: comment.id });

    const mentioned = await this.extractMentionedUserIds(body);
    for (const userId of mentioned) {
      await this.notifications.notify(userId, 'comment_mention', { taskId: id, taskTitle: task.title });
    }
    return comment;
  }

  private async extractMentionedUserIds(body: string): Promise<string[]> {
    const emails = [...body.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((m) => m[1]);
    if (!emails.length) return [];
    const users = await this.prisma.user.findMany({ where: { email: { in: emails } } });
    return users.map((u) => u.id);
  }

  private async resolveDefaultWorkflow(departmentId: string) {
    const deptSpecific = await this.prisma.workflowDefinition.findFirst({
      where: { departmentId, isActive: true },
    });
    if (deptSpecific) return deptSpecific;

    const orgDefault = await this.prisma.workflowDefinition.findFirst({
      where: { departmentId: null, isDefault: true, isActive: true },
    });
    if (!orgDefault) throw new BadRequestException('No default workflow is configured');
    return orgDefault;
  }

  private async resolveDefaultPriority(departmentId: string) {
    const deptSpecific = await this.prisma.priorityDefinition.findFirst({
      where: { departmentId, isDefault: true, isActive: true },
    });
    if (deptSpecific) return deptSpecific;

    const orgDefault = await this.prisma.priorityDefinition.findFirst({
      where: { departmentId: null, isDefault: true, isActive: true },
    });
    if (!orgDefault) throw new BadRequestException('No default priority is configured');
    return orgDefault;
  }

  private async upsertCustomFieldValues(
    taskId: string,
    departmentId: string,
    values: Record<string, unknown>,
  ) {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { OR: [{ departmentId }, { departmentId: null }], isActive: true },
    });
    const byKey = new Map(definitions.map((d) => [d.key, d]));

    for (const [key, value] of Object.entries(values)) {
      const def = byKey.get(key);
      if (!def) continue; // unknown field for this department — ignore rather than 400, matches "extra fields ignored" convention
      await this.prisma.taskCustomFieldValue.upsert({
        where: { taskId_fieldDefinitionId: { taskId, fieldDefinitionId: def.id } },
        update: { value: value as Prisma.InputJsonValue },
        create: { taskId, fieldDefinitionId: def.id, value: value as Prisma.InputJsonValue },
      });
    }
  }

  private async logActivity(taskId: string, actorId: string, action: string, metadata: Record<string, unknown>) {
    await this.prisma.activityLogEntry.create({
      data: { taskId, actorId, action, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}
