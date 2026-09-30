import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.service';
import { assertDepartmentScope, departmentScopeWhere } from '../common/scope.util';
import { decodeCursor, encodeCursor } from '../common/cursor-pagination.util';
import { isOverdueOnBusinessDay } from '../common/business-days.util';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import type { CreateTaskDto, ReviewAttachmentItemDto, TaskListQueryDto, UpdateTaskDto } from './dto/task.dto';

interface Cursor {
  id: string;
  sortValue: string;
}

@Injectable()
export class TasksService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly holidayCalendars: HolidayCalendarsService,
    private readonly storage: StorageService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureDefaultWorkflowStatuses();
      await this.remediateIncompleteTasksToTodo();
    } catch (err) {
      console.warn('[TasksService] onApplicationBootstrap error:', err);
    }
  }

  /**
   * Remediates any active tasks in an In Progress status that are missing mandatory
   * scheduling specifications (Start Date, Due Date, or Effort Estimate). Pushes them
   * back to the initial Todo status with timer stopped so work cannot proceed without details.
   */
  async remediateIncompleteTasksToTodo() {
    try {
      const incompleteTasks = await this.prisma.task.findMany({
        where: {
          deletedAt: null,
          status: { category: 'in_progress' },
          OR: [
            { startDate: null },
            { dueDate: null },
            { estimateValue: null },
            { estimateValue: { lte: 0 } },
          ],
        },
        include: { workflow: true },
      });

      for (const t of incompleteTasks) {
        const todoStatus = await this.prisma.workflowStatus.findFirst({
          where: { workflowId: t.workflowId, category: 'todo' },
          orderBy: { displayOrder: 'asc' },
        });
        if (todoStatus) {
          await this.prisma.task.update({
            where: { id: t.id },
            data: { statusId: todoStatus.id, timerStartedAt: null },
          });
          await this.logActivity(t.id, t.createdById, 'remediated_to_todo', {
            note: 'Pushed back to Todo: missing required scheduling details (start date, due date, or effort estimate)',
          });
        }
      }
    } catch (err) {
      console.warn('[TasksService] remediateIncompleteTasksToTodo error:', err);
    }
  }

  /**
   * Returns daily working limit in minutes.
   * If estimate_value is given in hours, daily budget is estimateValue * 60.
   * If no hours given (or days unit), default is 6 hours (360 minutes).
   */
  getDailyCapMinutes(task: { estimateValue?: number | null; estimateUnit?: string | null }): number {
    if (task.estimateValue && task.estimateValue > 0) {
      if (task.estimateUnit === 'hours') {
        return Math.round(task.estimateValue * 60);
      }
      return 6 * 60;
    }
    return 6 * 60;
  }

  /**
   * Checks whether the current live session has exceeded the daily limit (e.g. 5h or 6h default).
   * If reached or exceeded, auto-banks the session up to the daily cap and clears timerStartedAt.
   */
  async checkAndAutoPauseDailyCap(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { status: true },
    });
    if (!task || !task.timerStartedAt) return task;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayLogs = await this.prisma.timeLog.findMany({
      where: { taskId, loggedAt: { gte: todayStart, lte: todayEnd } },
    });
    const todayLoggedMinutes = todayLogs.reduce((sum, l) => sum + l.minutes, 0);
    const dailyCapMinutes = this.getDailyCapMinutes(task);

    const currentSessionMinutes = Math.max(0, Math.floor((now.getTime() - task.timerStartedAt.getTime()) / 60000));

    if (todayLoggedMinutes + currentSessionMinutes >= dailyCapMinutes) {
      const minutesToBank = Math.max(1, dailyCapMinutes - todayLoggedMinutes);
      await this.prisma.timeLog.create({
        data: {
          taskId,
          userId: task.assigneeId ?? task.createdById,
          minutes: minutesToBank,
          note: 'Auto-logged: daily work limit reached (auto-paused)',
          loggedAt: now,
        },
      });

      const newTotal = await this.sumTimeLogMinutes(taskId);
      const updated = await this.prisma.task.update({
        where: { id: taskId },
        data: { timerStartedAt: null, totalLoggedMinutes: newTotal },
        include: {
          customFieldValues: true,
          subtasks: { where: { deletedAt: null }, include: { status: true } },
          status: true,
          priority: true,
          assignee: { select: { id: true, fullName: true, email: true, managerId: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          department: { select: { id: true, name: true } },
        },
      });
      await this.logActivity(taskId, task.assigneeId ?? task.createdById, 'auto_paused', {
        note: `Daily limit of ${Math.round(dailyCapMinutes / 60)}h reached — timer automatically paused`,
      });
      return updated;
    }
    return task;
  }

  /**
   * True for Admin, Management, Head, Manager roles (any role that has task.delete).
   * Employees do NOT have task.delete, making this the clean dividing line.
   * Used to scope read/write operations so employees only act on their own tasks.
   */
  private isManagerOrAbove(user: AccessTokenPayload): boolean {
    return user.hasOrgWideRole || user.permissions.includes('task.delete');
  }

  /**
   * Checks if user has the authority to directly archive or permanently delete a task
   * without needing an approval request. Follows role-based rules:
   * 1. Admin (org-wide role) — full authority.
   * 2. Department Head — in-charge person of the task's department.
   * 3. Direct Manager of the assignee.
   * 4. Manager with task.delete in department when department has no head or user is head.
   */
  async canDirectlyManageTask(
    user: AccessTokenPayload,
    task: { departmentId: string; assigneeId?: string | null },
  ): Promise<boolean> {
    if (user.hasOrgWideRole) return true;

    const dept = await this.prisma.department.findUnique({
      where: { id: task.departmentId },
      select: { headUserId: true },
    });
    if (dept?.headUserId === user.sub) return true;

    if (task.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: task.assigneeId },
        select: { managerId: true },
      });
      if (assignee?.managerId === user.sub) return true;
    }

    if (this.isManagerOrAbove(user) && (!dept?.headUserId || dept.headUserId === user.sub)) {
      return true;
    }

    return false;
  }

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

    if (query.due_this_week) {
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      where.dueDate = { gte: now, lte: weekEnd };
      where.status = { category: { in: ['todo', 'in_progress'] } };
    }

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
        assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { subtasks: true } },
      },
    });

    const hasMore = tasks.length > limit;
    const page = tasks.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page.map((t) => ({
        ...t,
        is_recurring: t.isRecurring,
        recurrence_rule: t.recurrenceRule,
        recurrence_index: t.recurrenceIndex,
        recurrence_parent_id: t.recurrenceParentId,
        start_date: t.startDate,
        due_date: t.dueDate,
        estimate_value: t.estimateValue,
        estimate_unit: t.estimateUnit,
        total_logged_minutes: t.totalLoggedMinutes,
      })),
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

    return {
      items: matches.slice(0, limit).map((t) => ({
        ...t,
        is_recurring: t.isRecurring,
        recurrence_rule: t.recurrenceRule,
        recurrence_index: t.recurrenceIndex,
        recurrence_parent_id: t.recurrenceParentId,
        start_date: t.startDate,
        due_date: t.dueDate,
        estimate_value: t.estimateValue,
        estimate_unit: t.estimateUnit,
        total_logged_minutes: t.timeLogs.reduce((sum, l) => sum + l.minutes, 0),
      })),
      next_cursor: null,
    };
  }

  async get(user: AccessTokenPayload, id: string) {
    // Check and auto-pause if daily cap reached
    await this.checkAndAutoPauseDailyCap(id);

    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        customFieldValues: true,
        subtasks: { where: { deletedAt: null }, include: { status: true } },
        status: true,
        priority: true,
        // Include managerId so the UI can show review-action controls and so the service
        // can notify the assignee's manager when the task enters a review status.
        assignee: { select: { id: true, fullName: true, email: true, managerId: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    // Compute true total from all logged sessions so manual logs and auto-logs are 100% unified
    const totalLoggedMinutes = await this.sumTimeLogMinutes(task.id);
    if (task.totalLoggedMinutes !== totalLoggedMinutes) {
      this.prisma.task.update({ where: { id }, data: { totalLoggedMinutes } }).catch(() => {});
    }

    // Attach computed estimate_minutes so clients don't need to do unit math themselves.
    const estimateMinutes =
      task.estimateValue !== null && task.estimateUnit !== null
        ? task.estimateUnit === 'days'
          ? Math.round(task.estimateValue * 8 * 60)
          : Math.round(task.estimateValue * 60)
        : null;
    return {
      ...task,
      timerStartedAt: task.timerStartedAt,
      timer_started_at: task.timerStartedAt ? task.timerStartedAt.toISOString() : null,
      totalLoggedMinutes,
      total_logged_minutes: totalLoggedMinutes,
      estimate_minutes: estimateMinutes,
      estimate_value: task.estimateValue,
      estimate_unit: task.estimateUnit,
      start_date: task.startDate,
      due_date: task.dueDate,
      is_recurring: task.isRecurring,
      recurrence_rule: task.recurrenceRule,
      recurrence_index: task.recurrenceIndex,
      recurrence_parent_id: task.recurrenceParentId,
    };
  }

  async create(user: AccessTokenPayload, dto: CreateTaskDto) {
    assertDepartmentScope(user, dto.department_id);

    // Regular employees can only create tasks assigned to themselves or unassigned.
    // Assigning to other users requires task.assign or manager role.
    const canAssignOthers = this.isManagerOrAbove(user) || user.permissions.includes('task.assign');
    if (!canAssignOthers && dto.assignee_id && dto.assignee_id !== user.sub) {
      throw new ForbiddenException(
        'Employees can only create tasks assigned to themselves. Manager or Admin permission is required to assign tasks to other team members.',
      );
    }

    // Start date must be today or future (date comparison at beginning of today in UTC/local)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dto.start_date) {
      const sDate = new Date(dto.start_date);
      // 12-hour timezone grace
      if (sDate.getTime() < today.getTime() - 12 * 3600 * 1000) {
        throw new BadRequestException('Start date cannot be set in the past.');
      }
    }

    if (dto.start_date && dto.due_date) {
      if (new Date(dto.due_date) < new Date(dto.start_date)) {
        throw new BadRequestException('Due date must be on or after the start date.');
      }
    }

    // For non-managers creating their own tasks, Start Date, Due Date, and Estimate are strictly required!
    if (!canAssignOthers) {
      if (!dto.start_date) {
        throw new BadRequestException('Start date is mandatory when creating a task.');
      }
      if (!dto.due_date) {
        throw new BadRequestException('Due date is mandatory when creating a task.');
      }
      if (!dto.estimate_value || dto.estimate_value <= 0) {
        throw new BadRequestException('Effort estimate is mandatory when creating a task.');
      }
    }

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
        estimateValue: dto.estimate_value ?? null,
        estimateUnit: dto.estimate_unit ?? 'hours',
        estimateSubmittedAt: dto.estimate_value ? new Date() : null,
        estimateSubmittedById: dto.estimate_value ? user.sub : null,
        isRecurring: dto.is_recurring ?? false,
        recurrenceRule: dto.is_recurring ? dto.recurrence_rule : null,
        recurrenceIndex: dto.recurrence_index ?? 1,
        recurrenceParentId: dto.recurrence_parent_id ?? null,
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

    if (!this.isManagerOrAbove(user) && existing.assigneeId !== user.sub) {
      throw new ForbiddenException('You cannot modify tasks assigned to other employees');
    }

    if (dto.start_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sDate = new Date(dto.start_date);
      if (sDate.getTime() < today.getTime() - 12 * 3600 * 1000) {
        throw new BadRequestException('Start date cannot be set in the past.');
      }
    }

    const effectiveStartDate = dto.start_date !== undefined ? (dto.start_date ? new Date(dto.start_date) : null) : existing.startDate;
    const effectiveDueDate = dto.due_date !== undefined ? (dto.due_date ? new Date(dto.due_date) : null) : existing.dueDate;

    if (effectiveStartDate && effectiveDueDate && effectiveDueDate < effectiveStartDate) {
      throw new BadRequestException('Due date must be on or after the start date.');
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priorityId: dto.priority_id,
        dueDate: dto.due_date === undefined ? undefined : dto.due_date ? new Date(dto.due_date) : null,
        startDate: dto.start_date === undefined ? undefined : dto.start_date ? new Date(dto.start_date) : null,
        slaPolicyId: dto.sla_policy_id === undefined ? undefined : dto.sla_policy_id,
        // RecurrenceWidget fields — only applied when present in the payload.
        ...(dto.is_recurring !== undefined && { isRecurring: dto.is_recurring }),
        ...(dto.recurrence_rule !== undefined && { recurrenceRule: dto.recurrence_rule }),
        ...(dto.recurrence_index !== undefined && { recurrenceIndex: dto.recurrence_index }),
        ...(dto.recurrence_parent_id !== undefined && { recurrenceParentId: dto.recurrence_parent_id }),
        // Effort estimation fields
        ...(dto.estimate_value !== undefined && {
          estimateValue: dto.estimate_value,
          estimateUnit: dto.estimate_unit ?? 'hours',
          estimateSubmittedAt: new Date(),
          estimateSubmittedById: user.sub,
        }),
      },
    });

    if (dto.custom_field_values) {
      await this.upsertCustomFieldValues(id, existing.departmentId, dto.custom_field_values);
    }

    await this.logActivity(id, user.sub, 'field_updated', { fields: Object.keys(dto) });
    return this.get(user, task.id);
  }

  async remove(user: AccessTokenPayload, id: string) {
    return this.archive(user, id);
  }

  async archive(user: AccessTokenPayload, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { department: true, assignee: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    const canManage = await this.canDirectlyManageTask(user, task);
    if (!canManage) {
      throw new ForbiddenException(
        'Employees cannot directly archive tasks. Please submit an archive request to your manager.',
      );
    }

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.logActivity(id, user.sub, 'archived', {});
    return { success: true, message: 'Task archived successfully' };
  }

  async unarchive(user: AccessTokenPayload, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    const isOwner = task.assigneeId === user.sub || task.createdById === user.sub;
    const canManage = await this.canDirectlyManageTask(user, task);
    if (!canManage && !isOwner) {
      throw new ForbiddenException('You do not have permission to unarchive this task.');
    }

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.logActivity(id, user.sub, 'unarchived', {});
    return { success: true, message: 'Task unarchived successfully' };
  }

  async permanentDelete(user: AccessTokenPayload, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { department: true, assignee: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    const canManage = await this.canDirectlyManageTask(user, task);
    if (!canManage) {
      throw new ForbiddenException(
        'Only managers, department heads, or admins can permanently delete tasks. Employees must submit a delete request.',
      );
    }

    await this.prisma.task.delete({ where: { id } });
    return { success: true, message: 'Task permanently deleted from database' };
  }

  async listArchived(user: AccessTokenPayload, departmentId?: string, query?: string) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: { not: null },
    };

    if (departmentId) {
      where.departmentId = departmentId;
    } else if (!user.hasOrgWideRole) {
      where.departmentId = { in: user.departmentIds };
    }

    if (query) {
      where.title = { contains: query, mode: 'insensitive' };
    }

    return this.prisma.task.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      include: {
        department: { select: { id: true, name: true } },
        status: { select: { id: true, label: true, color: true } },
        priority: { select: { id: true, label: true, color: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async requestAction(
    user: AccessTokenPayload,
    taskId: string,
    actionType: 'archive' | 'delete',
    reason?: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, department: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    const existingRequest = await this.prisma.taskActionRequest.findFirst({
      where: { taskId, status: 'pending' },
    });
    if (existingRequest) {
      throw new BadRequestException(
        `There is already a pending ${existingRequest.actionType} request for this task.`,
      );
    }

    const request = await this.prisma.taskActionRequest.create({
      data: {
        taskId,
        actionType,
        requesterId: user.sub,
        reason,
        status: 'pending',
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        task: { select: { id: true, title: true, departmentId: true } },
      },
    });

    await this.logActivity(taskId, user.sub, 'action_requested', {
      actionType,
      requestId: request.id,
      reason,
    });

    // Notify manager or department head
    const targetUserId = task.assignee?.managerId ?? task.department?.headUserId;
    if (targetUserId && targetUserId !== user.sub) {
      const requester = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { fullName: true },
      });
      await this.notifications.notify(targetUserId, 'task_action_requested', {
        taskId,
        taskTitle: task.title,
        actionType,
        requesterName: requester?.fullName ?? user.email,
      });
    }

    return request;
  }

  async decideActionRequest(
    user: AccessTokenPayload,
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewerNote?: string,
  ) {
    const req = await this.prisma.taskActionRequest.findUnique({
      where: { id: requestId },
      include: {
        task: { include: { department: true, assignee: true } },
        requester: true,
      },
    });
    if (!req) throw new NotFoundException('Action request not found');
    if (req.status !== 'pending') {
      throw new BadRequestException('This action request has already been decided.');
    }

    assertDepartmentScope(user, req.task.departmentId, req.task.assigneeId);

    const canManage = await this.canDirectlyManageTask(user, req.task);
    if (!canManage) {
      throw new ForbiddenException(
        'Only managers, department heads, or admins can decide this request.',
      );
    }

    await this.prisma.taskActionRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        reviewerId: user.sub,
        reviewerNote,
        decidedAt: new Date(),
      },
    });

    if (decision === 'approved') {
      if (req.actionType === 'archive') {
        await this.prisma.task.update({
          where: { id: req.taskId },
          data: { deletedAt: new Date() },
        });
        await this.logActivity(req.taskId, user.sub, 'archived', { approvedRequestId: req.id });
      } else if (req.actionType === 'delete') {
        await this.prisma.task.delete({ where: { id: req.taskId } });
      }
    }

    if (req.requesterId && req.requesterId !== user.sub) {
      await this.notifications.notify(req.requesterId, 'task_action_decided', {
        taskId: req.taskId,
        taskTitle: req.task.title,
        decision,
        actionType: req.actionType,
      });
    }

    return { success: true, decision };
  }

  async listPendingActionRequests(user: AccessTokenPayload) {
    const where: Prisma.TaskActionRequestWhereInput = {
      status: 'pending',
    };

    if (!user.hasOrgWideRole) {
      where.task = {
        departmentId: { in: user.departmentIds },
      };
    }

    return this.prisma.taskActionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        task: {
          select: {
            id: true,
            title: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
            status: { select: { id: true, label: true, color: true } },
            assignee: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
  }

  async getActionRequestForTask(user: AccessTokenPayload, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { departmentId: true, assigneeId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    return this.prisma.taskActionRequest.findFirst({
      where: { taskId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async assign(user: AccessTokenPayload, id: string, assigneeId: string | null) {
    const existing = await this.get(user, id);
    const previousAssigneeId = existing.assigneeId;

    // Self-assignment is allowed for any employee in the department for unassigned tasks.
    // Reassigning to other users or unassigning requires being the task creator or a manager/admin.
    const isCreator = existing.createdById === user.sub;
    const canAssignOthers = this.isManagerOrAbove(user) || isCreator;
    if (!canAssignOthers && assigneeId !== user.sub) {
      throw new ForbiddenException(
        'Only the task creator or a manager/admin can reassign this task to other team members.',
      );
    }

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

    // Employees can only move tasks that are assigned to them.
    if (!this.isManagerOrAbove(user) && existing.assigneeId !== user.sub) {
      throw new ForbiddenException(
        'You can only change the status of tasks that are assigned to you.',
      );
    }

    let transition = await this.prisma.workflowTransition.findFirst({
      where: { workflowId: existing.workflowId, fromStatusId: existing.statusId, toStatusId },
    });
    if (!transition) {
      const toStatusCandidate = await this.prisma.workflowStatus.findFirst({
        where: { workflowId: existing.workflowId, id: toStatusId },
      });
      if (toStatusCandidate) {
        transition = await this.prisma.workflowTransition
          .create({
            data: {
              workflowId: existing.workflowId,
              fromStatusId: existing.statusId,
              toStatusId,
            },
          })
          .catch(() => null);
      }
    }
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

    // Check mandatory fields before entering In Progress
    if (this.isInProgressStatus(toStatus)) {
      if (!existing.startDate || !existing.dueDate || !existing.estimateValue || existing.estimateValue <= 0) {
        throw new BadRequestException(
          'Cannot start work on this task. Start Date, Due Date, and Effort Estimate are mandatory before entering In Progress.',
        );
      }
    }

    const openBlockers = await this.getOpenBlockers(id, toStatusId);
    const task = await this.applyStatusChange(id, toStatusId, user.sub, onHoldReasonId);
    return { ...task, warnings: openBlockers.length ? { open_blockers: openBlockers } : undefined };
  }

  private isReviewStatus(status: { isReviewStatus?: boolean | null; key?: string | null; label?: string | null }): boolean {
    return Boolean(
      status.isReviewStatus ||
      status.key === 'in_review' ||
      (status.label && status.label.toLowerCase().includes('review'))
    );
  }

  private isInProgressStatus(status: { category?: string | null; isReviewStatus?: boolean | null; key?: string | null; label?: string | null }): boolean {
    return status.category === 'in_progress' && !this.isReviewStatus(status);
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

    const wasRunning = before.timerStartedAt !== null;
    const isEnteringReview = this.isReviewStatus(toStatus);
    const isEnteringInProgress = this.isInProgressStatus(toStatus);

    let sessionMinutes = 0;
    let newTotalLogged = before.totalLoggedMinutes;

    // ── Timer lifecycle ────────────────────────────────────────────────────────
    // When timer was running and task is moving OUT of active in-progress (into review, on hold, todo, done, etc.):
    // Stop the timer and bank elapsed session time into TimeLog.
    if (wasRunning && !isEnteringInProgress) {
      const elapsedMs = Date.now() - before.timerStartedAt!.getTime();
      // If at least 15 seconds elapsed, bank at least 1 minute so work isn't lost
      if (elapsedMs >= 15000) {
        sessionMinutes = Math.max(1, Math.round(elapsedMs / 60000));
      } else {
        sessionMinutes = 0;
      }

      if (sessionMinutes > 0) {
        const note = isEnteringReview
          ? 'Auto-logged: submitted for review'
          : `Auto-logged: paused work (${toStatus.label})`;

        await this.prisma.timeLog.create({
          data: {
            taskId: id,
            userId: before.assigneeId ?? actorId,
            minutes: sessionMinutes,
            note,
            loggedAt: new Date(),
          },
        });
        await this.logActivity(id, actorId, 'time_logged', { minutes: sessionMinutes, note });
      }

      // Re-sum all time logs to have the exact true total
      newTotalLogged = await this.sumTimeLogMinutes(id);
    } else if (!wasRunning) {
      // Keep totalLoggedMinutes in sync with actual TimeLog sum
      newTotalLogged = await this.sumTimeLogMinutes(id);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        statusId: toStatusId,
        completedAt: toStatus.category === 'done' ? new Date() : null,
        onHoldReasonId: toStatus.requiresHoldReason ? onHoldReasonId : null,
        // Start or resume timer when entering in_progress (and not review)
        timerStartedAt: isEnteringInProgress ? (wasRunning ? before.timerStartedAt : new Date()) : null,
        totalLoggedMinutes: newTotalLogged,
      },
    });
    // ── End timer lifecycle ────────────────────────────────────────────────────

    await this.logActivity(id, actorId, 'status_changed', { from: before.statusId, to: toStatusId });

    if (task.assigneeId) {
      await this.notifications.notify(task.assigneeId, 'status_changed', { taskId: id, taskTitle: task.title });
    }

    if (toStatus.requiresHoldReason) {
      await this.notifications.notify(task.createdById, 'task_on_hold', { taskId: id, taskTitle: task.title });
    }

    // When entering a review status: notify the assignee's manager, department head, and higher roles.
    if (isEnteringReview) {
      await this.notifyReviewersOfSubmission(task, actorId);
    }

    if (toStatus.category === 'done' && task.isRecurring && task.recurrenceRule) {
      await this.generateNextOccurrence(task);
    }

    return {
      ...task,
      timerStartedAt: task.timerStartedAt,
      timer_started_at: task.timerStartedAt ? task.timerStartedAt.toISOString() : null,
      totalLoggedMinutes: task.totalLoggedMinutes,
      total_logged_minutes: task.totalLoggedMinutes,
    };
  }

  // ── Review actions (manager/head/admin only) ────────────────────────────────

  /**
   * Manager-facing review decision on a task that is currently in a review-gate status.
   * - approve: moves to the first 'done' status in the workflow, resolves active reviews.
   * - request_changes: moves back to the first 'todo' status, records a TaskReview with
   *   mandatory comments and optional reference attachments, and notifies the assignee.
   */
  async reviewAction(
    user: AccessTokenPayload,
    taskId: string,
    action: 'approve' | 'request_changes',
    comment?: string,
    attachments?: ReviewAttachmentItemDto[],
  ) {
    if (!this.isManagerOrAbove(user)) {
      throw new ForbiddenException('Only managers and above can approve or request changes on tasks.');
    }
    if (action === 'request_changes' && (!comment || !comment.trim())) {
      throw new BadRequestException('A comment explaining what needs to change is required when requesting changes.');
    }

    const task = await this.get(user, taskId);

    // Verify the task is currently in a review-gate status.
    const currentStatus = await this.prisma.workflowStatus.findUniqueOrThrow({ where: { id: task.statusId } });
    if (!this.isReviewStatus(currentStatus)) {
      throw new BadRequestException('This task is not currently in a review status.');
    }

    // Find target status in the same workflow.
    const targetCategory = action === 'approve' ? 'done' : 'todo';
    const targetStatus = await this.prisma.workflowStatus.findFirst({
      where: { workflowId: task.workflowId, category: targetCategory },
      orderBy: { displayOrder: 'asc' },
    });
    if (!targetStatus) {
      throw new BadRequestException(`No '${targetCategory}' status found in this workflow.`);
    }

    // Apply the status change (this also handles timer/TimeLog cleanup).
    await this.applyStatusChange(taskId, targetStatus.id, user.sub);

    // Create the formal TaskReview record
    const review = await this.prisma.taskReview.create({
      data: {
        taskId,
        reviewerId: user.sub,
        decision: action === 'approve' ? 'approved' : 'changes_requested',
        feedback: comment?.trim() || (action === 'approve' ? 'Approved and marked Done' : 'Changes requested'),
        status: action === 'request_changes' ? 'active' : 'resolved',
        resolvedAt: action === 'approve' ? new Date() : null,
      },
    });

    // Save any reference attachments uploaded by the reviewer
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const sanitizedName = att.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `review-attachments/${taskId}/${Date.now()}-${sanitizedName}`;
        try {
          // Review attachments are uploaded by the client directly via the
          // POST /tasks/:id/attachments/upload-url → GCS → POST /attachments/:id/confirm
          // flow (P5-04). The legacy base64 path is no longer supported with GCS.
          await this.prisma.taskReviewAttachment.create({
            data: {
              reviewId: review.id,
              fileName: att.file_name,
              storagePath: `review-attachments/${taskId}/${Date.now()}-${att.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
              mimeType: att.mime_type,
              sizeBytes: BigInt(att.size_bytes),
            },
          });
        } catch (err) {
          console.error('[TasksService] Failed to save review attachment:', err);
        }
      }
    }

    // When approving, resolve any older active review requests for this task
    if (action === 'approve') {
      await this.prisma.taskReview.updateMany({
        where: { taskId, status: 'active', id: { not: review.id } },
        data: { status: 'resolved', resolvedAt: new Date() },
      });
    }

    // Notify the assignee of the review outcome
    if (task.assigneeId) {
      const reviewer = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { fullName: true },
      });
      const notifType = action === 'approve' ? 'task_approved' : 'review_changes_requested';
      await this.notifications.notify(task.assigneeId, notifType, {
        taskId,
        taskTitle: task.title,
        reviewerName: reviewer?.fullName ?? 'Manager',
        reviewAction: action,
        comment: comment?.trim(),
        attachmentCount: attachments?.length ?? 0,
      });
    }

    await this.logActivity(
      taskId,
      user.sub,
      action === 'approve' ? 'review_approved' : 'review_changes_requested',
      { action, comment: comment?.trim(), attachmentCount: attachments?.length ?? 0 },
    );

    return this.get(user, taskId);
  }

  /**
   * Fetches all formal review records for a task, with reviewer details and attachments.
   */
  async getReviews(user: AccessTokenPayload, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    assertDepartmentScope(user, task.departmentId, task.assigneeId);

    const reviews = await this.prisma.taskReview.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        attachments: true,
      },
    });

    return Promise.all(reviews.map(async (r) => ({
      id: r.id,
      task_id: r.taskId,
      reviewer_id: r.reviewerId,
      reviewer: r.reviewer
        ? {
            id: r.reviewer.id,
            full_name: r.reviewer.fullName,
            email: r.reviewer.email,
            avatar_url: r.reviewer.avatarUrl,
          }
        : undefined,
      decision: r.decision,
      feedback: r.feedback,
      status: r.status,
      created_at: r.createdAt.toISOString(),
      resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      attachments: await Promise.all(r.attachments.map(async (a) => ({
        id: a.id,
        review_id: a.reviewId,
        file_name: a.fileName,
        storage_path: a.storagePath,
        mime_type: a.mimeType,
        size_bytes: Number(a.sizeBytes),
        created_at: a.createdAt.toISOString(),
        download_url: await this.storage.getDownloadUrl(a.storagePath).catch(() => null),
      }))),
    })));
  }

  /**
   * Called by an employee when they have finished making requested changes
   * and want to re-submit the task for manager review.
   */
  async resubmitReview(user: AccessTokenPayload, taskId: string, note?: string) {
    const task = await this.get(user, taskId);
    if (!this.isManagerOrAbove(user) && task.assigneeId !== user.sub) {
      throw new ForbiddenException('Only the assignee or a manager can resubmit this task for review.');
    }

    // Find review status in the workflow
    const inReviewStatus = await this.prisma.workflowStatus.findFirst({
      where: { workflowId: task.workflowId, isReviewStatus: true },
    });
    if (!inReviewStatus) {
      throw new BadRequestException('No review status found in this workflow.');
    }

    // Mark previous active reviews as resolved
    await this.prisma.taskReview.updateMany({
      where: { taskId, status: 'active' },
      data: { status: 'resolved', resolvedAt: new Date() },
    });

    // Move task to in_review status
    await this.applyStatusChange(taskId, inReviewStatus.id, user.sub);

    if (note?.trim()) {
      await this.prisma.taskComment.create({
        data: { taskId, authorId: user.sub, body: `[Resubmitted for Review]: ${note.trim()}` },
      });
    }

    await this.logActivity(taskId, user.sub, 'resubmitted_for_review', { note: note?.trim() });

    return { success: true, message: 'Task resubmitted for review successfully' };
  }

  private async notifyReviewersOfSubmission(
    task: { id: string; title: string; departmentId: string; assigneeId?: string | null },
    actorId: string,
  ) {
    const recipients = new Set<string>();

    if (task.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: task.assigneeId },
        select: { id: true, fullName: true, managerId: true },
      });
      if (assignee?.managerId && assignee.managerId !== actorId) {
        recipients.add(assignee.managerId);
      }
    }

    // Notify Department Head
    const department = await this.prisma.department.findUnique({
      where: { id: task.departmentId },
      select: { headUserId: true },
    });
    if (department?.headUserId && department.headUserId !== actorId) {
      recipients.add(department.headUserId);
    }

    // If no direct supervisor or head, alert managers/admins in the department
    if (recipients.size === 0) {
      const deptManagers = await this.prisma.user.findMany({
        where: {
          id: { not: actorId },
          isActive: true,
          OR: [
            {
              primaryDepartmentId: task.departmentId,
              roles: {
                some: {
                  role: {
                    permissions: { some: { permission: { key: 'task.delete' } } },
                  },
                },
              },
            },
            {
              roles: {
                some: {
                  role: { isSystemRole: true, name: 'Admin' },
                },
              },
            },
          ],
        },
        select: { id: true },
        take: 5,
      });
      for (const m of deptManagers) {
        recipients.add(m.id);
      }
    }

    const assignee = task.assigneeId
      ? await this.prisma.user.findUnique({ where: { id: task.assigneeId }, select: { fullName: true } })
      : null;

    for (const recipientId of recipients) {
      await this.notifications.notify(recipientId, 'task_submitted_for_review', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeName: assignee?.fullName ?? 'An employee',
      });
    }
  }

  /**
   * Ensures all workflows have an 'In Review' status flagged as isReviewStatus=true
   * and the 'In Progress' status flagged as requiresEstimateBeforeEntry=true.
   * Called from onApplicationBootstrap in the workflow seeder.
   */
  async ensureDefaultWorkflowStatuses() {
    const workflows = await this.prisma.workflowDefinition.findMany({
      include: { statuses: true, transitions: true },
    });
    for (const wf of workflows) {
      const inProgressStatus = wf.statuses.find((s) => s.key === 'in_progress');
      let inReviewStatus = wf.statuses.find((s) => s.key === 'in_review' || (s.label && s.label.toLowerCase().includes('review')));
      const todoStatus = wf.statuses.find((s) => s.key === 'todo');
      const doneStatus = wf.statuses.find((s) => s.key === 'done');

      // Ensure in_review status exists and has isReviewStatus = true
      if (!inReviewStatus) {
        inReviewStatus = await this.prisma.workflowStatus.create({
          data: {
            workflowId: wf.id,
            key: 'in_review',
            label: 'In Review',
            category: 'in_progress',
            displayOrder: (inProgressStatus?.displayOrder ?? 1) + 1,
            color: '#f59e0b',
            requiresHoldReason: false,
            requiresEstimateBeforeEntry: false,
            isReviewStatus: true,
          },
        }).catch(() => undefined);
      } else if (!inReviewStatus.isReviewStatus) {
        await this.prisma.workflowStatus.update({
          where: { id: inReviewStatus.id },
          data: { isReviewStatus: true },
        }).catch(() => {});
      }

      // Ensure essential transitions exist
      if (inProgressStatus && inReviewStatus) {
        const hasProgToRev = wf.transitions.some(
          (t) => t.fromStatusId === inProgressStatus.id && t.toStatusId === inReviewStatus!.id,
        );
        if (!hasProgToRev) {
          await this.prisma.workflowTransition.create({
            data: { workflowId: wf.id, fromStatusId: inProgressStatus.id, toStatusId: inReviewStatus.id },
          }).catch(() => {});
        }
      }

      if (inReviewStatus && doneStatus) {
        const hasRevToDone = wf.transitions.some(
          (t) => t.fromStatusId === inReviewStatus!.id && t.toStatusId === doneStatus.id,
        );
        if (!hasRevToDone) {
          await this.prisma.workflowTransition.create({
            data: { workflowId: wf.id, fromStatusId: inReviewStatus.id, toStatusId: doneStatus.id },
          }).catch(() => {});
        }
      }

      if (inReviewStatus && todoStatus) {
        const hasRevToTodo = wf.transitions.some(
          (t) => t.fromStatusId === inReviewStatus!.id && t.toStatusId === todoStatus.id,
        );
        if (!hasRevToTodo) {
          await this.prisma.workflowTransition.create({
            data: { workflowId: wf.id, fromStatusId: inReviewStatus.id, toStatusId: todoStatus.id },
          }).catch(() => {});
        }
      }
    }
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
    } else if (!isOverride) {
      // A task with no estimate yet: only the current assignee can submit the first estimate.
      // If the task is unassigned, only a Manager or above may submit.
      if (task.assigneeId === null) {
        if (!this.isManagerOrAbove(user)) {
          throw new ForbiddenException('Only a Manager can submit an estimate for an unassigned task.');
        }
      } else if (task.assigneeId !== user.sub) {
        throw new ForbiddenException('Only the assignee can submit an effort estimate for this task.');
      }
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

  /**
   * Employee clock-out — banks the active session time into a TimeLog and stops the timer
   * without changing the task's workflow status. The task stays In Progress; the assignee
   * can restart the timer later by simply transitioning back into In Progress.
   */
  async clockOut(user: AccessTokenPayload, taskId: string) {
    const existing = await this.get(user, taskId);

    if (!this.isManagerOrAbove(user) && existing.assigneeId !== user.sub) {
      throw new ForbiddenException('You can only clock out of tasks assigned to you.');
    }

    const before = await this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });

    // Idempotent: if timer is already stopped, nothing to bank.
    if (before.timerStartedAt === null) {
      return this.get(user, taskId);
    }

    // Bank elapsed session time using the same rounding rules as applyStatusChange.
    const elapsedMs = Date.now() - before.timerStartedAt.getTime();
    let sessionMinutes = 0;
    if (elapsedMs >= 15000) {
      sessionMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    }

    if (sessionMinutes > 0) {
      await this.prisma.timeLog.create({
        data: {
          taskId,
          userId: before.assigneeId ?? user.sub,
          minutes: sessionMinutes,
          note: 'Auto-logged: employee clocked out',
          loggedAt: new Date(),
        },
      });
      await this.logActivity(taskId, user.sub, 'time_logged', { minutes: sessionMinutes, note: 'Auto-logged: employee clocked out' });
    }

    const newTotalLogged = await this.sumTimeLogMinutes(taskId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { timerStartedAt: null, totalLoggedMinutes: newTotalLogged },
    });

    await this.notifyIfEffortBudgetCrossed(existing, newTotalLogged - sessionMinutes, newTotalLogged);
    await this.logActivity(taskId, user.sub, 'clocked_out', {});

    return this.get(user, taskId);
  }

  /**
   * Employee clock-in — resumes or starts the live session timer on a task that is currently
   * in an In Progress status (e.g. after clocking out, or returning to work).
   * Idempotent: if the timer is already running, returns the task without modification.
   */
  async clockIn(user: AccessTokenPayload, taskId: string) {
    const existing = await this.get(user, taskId);

    if (!this.isManagerOrAbove(user) && existing.assigneeId !== user.sub) {
      throw new ForbiddenException('You can only clock in to tasks assigned to you.');
    }

    const before = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { status: true },
    });

    if (!this.isInProgressStatus(before.status)) {
      throw new BadRequestException('Clock in is only available for tasks in an In Progress status.');
    }

    // Ensure mandatory scheduling details are provided before clocking in
    if (!before.startDate || !before.dueDate || !before.estimateValue || before.estimateValue <= 0) {
      throw new BadRequestException(
        'Cannot clock in to this task. Start Date, Due Date, and Effort Estimate are mandatory before starting work.',
      );
    }

    // Idempotent: if timer is already running, return existing task.
    if (before.timerStartedAt !== null) {
      return this.get(user, taskId);
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { timerStartedAt: new Date() },
    });

    await this.logActivity(taskId, user.sub, 'clocked_in', { note: 'Employee clocked in' });

    return this.get(user, taskId);
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

  /**
   * Aggregated timesheet — returns one row per task with total logged minutes.
   * Employees see only their own tasks; managers/admins see all tasks in the given department.
   */
  async listAllTimeLogs(
    user: AccessTokenPayload,
    params: { department_id?: string; from?: string; to?: string; user_id?: string },
  ) {
    const isPrivileged = this.isManagerOrAbove(user);

    // Employees are always scoped to their own tasks only
    const assigneeFilter = !isPrivileged ? user.sub : params.user_id ?? undefined;

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(assigneeFilter ? { assigneeId: assigneeFilter } : {}),
      ...(params.department_id ? { departmentId: params.department_id } : {}),
      // If date filters are provided, include tasks whose due_date or start_date falls in range
      ...(params.from || params.to
        ? {
            OR: [
              {
                dueDate: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              },
              {
                startDate: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              },
            ],
          }
        : {}),
    };

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 500,
      include: {
        status: { select: { id: true, label: true, color: true, category: true } },
        priority: { select: { id: true, label: true, color: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
        timeLogs: { select: { minutes: true } },
      },
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      assignee_id: t.assigneeId,
      assignee_name: t.assignee?.fullName ?? null,
      assignee_email: t.assignee?.email ?? null,
      department_id: t.departmentId,
      department_name: t.department?.name ?? null,
      status: t.status,
      priority: t.priority,
      start_date: t.startDate,
      due_date: t.dueDate,
      created_at: t.createdAt,
      total_logged_minutes: t.timeLogs.reduce((sum, l) => sum + l.minutes, 0),
    }));
  }

  /**
   * Per-employee timesheet detail — returns every task assigned to a given user with
   * all individual time-log entries expanded. Role-scoped: employees can only query their
   * own ID; managers/admins can query any user in their department scope.
   */
  async employeeTimesheetDetail(
    actor: AccessTokenPayload,
    targetUserId: string,
    params: { department_id?: string; from?: string; to?: string },
  ) {
    const isPrivileged = this.isManagerOrAbove(actor);

    // Employees can only view their own detail
    if (!isPrivileged && actor.sub !== targetUserId) {
      throw new ForbiddenException('You can only view your own timesheet detail.');
    }

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      assigneeId: targetUserId,
      ...(params.department_id ? { departmentId: params.department_id } : {}),
      ...(params.from || params.to
        ? {
            OR: [
              {
                dueDate: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              },
              {
                startDate: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              },
            ],
          }
        : {}),
    };

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 500,
      include: {
        status: { select: { id: true, label: true, color: true, category: true } },
        priority: { select: { id: true, label: true, color: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
        timeLogs: {
          orderBy: { loggedAt: 'asc' },
          select: { id: true, minutes: true, note: true, loggedAt: true, createdAt: true },
        },
      },
    });

    return tasks.map((t) => {
      // Convert estimateValue + estimateUnit to minutes for the frontend
      let estimateMinutes: number | null = null;
      if (t.estimateValue != null && t.estimateUnit != null) {
        const multipliers: Record<string, number> = { minutes: 1, hours: 60, days: 480 };
        estimateMinutes = Math.round(t.estimateValue * (multipliers[t.estimateUnit] ?? 60));
      }
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        assignee_id: t.assigneeId,
        assignee_name: t.assignee?.fullName ?? null,
        assignee_email: t.assignee?.email ?? null,
        department_name: t.department?.name ?? null,
        status: t.status,
        priority: t.priority,
        start_date: t.startDate,
        due_date: t.dueDate,
        created_at: t.createdAt,
        effort_estimate_minutes: estimateMinutes,
        total_logged_minutes: t.timeLogs.reduce((sum, l) => sum + l.minutes, 0),
        time_logs: t.timeLogs.map((l) => ({
          id: l.id,
          minutes: l.minutes,
          note: l.note,
          logged_at: l.loggedAt,
          created_at: l.createdAt,
        })),
      };
    });
  }

  async addTimeLog(user: AccessTokenPayload, taskId: string, minutes: number, note?: string, loggedAt?: string) {
    const task = await this.get(user, taskId);
    const totalBefore = await this.sumTimeLogMinutes(taskId);

    const log = await this.prisma.timeLog.create({
      data: { taskId, userId: user.sub, minutes, note, loggedAt: loggedAt ? new Date(loggedAt) : undefined },
    });
    await this.logActivity(taskId, user.sub, 'time_logged', { minutes, timeLogId: log.id });

    const totalAfter = totalBefore + minutes;
    await this.prisma.task.update({
      where: { id: taskId },
      data: { totalLoggedMinutes: totalAfter },
    }).catch(() => {});

    await this.notifyIfEffortBudgetCrossed(task, totalBefore, totalAfter);
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
    await this.prisma.task.update({
      where: { id: taskId },
      data: { totalLoggedMinutes: totalAfter },
    }).catch(() => {});

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
   * Notifies both the assigned employee and the person who created/assigned the task.
   */
  private async notifyIfEffortBudgetCrossed(
    task: { id: string; title: string; assigneeId?: string | null; createdById?: string | null; estimateValue?: number | null; estimateUnit?: string | null; timerStartedAt?: Date | null },
    totalBefore: number,
    totalAfter: number,
  ) {
    if (!task.estimateValue || !task.estimateUnit) return;
    const estimateMinutes = task.estimateUnit === 'days' ? task.estimateValue * 8 * 60 : task.estimateValue * 60;
    if (estimateMinutes <= 0) return;

    if (totalBefore <= estimateMinutes && totalAfter > estimateMinutes) {
      // --- Auto-pause the timer if it's currently running ---
      const liveTask = await this.prisma.task.findUnique({
        where: { id: task.id },
        select: { timerStartedAt: true, assigneeId: true },
      });
      if (liveTask?.timerStartedAt) {
        const elapsedMs = Date.now() - liveTask.timerStartedAt.getTime();
        const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
        // Bank the live session time
        await this.prisma.timeLog.create({
          data: {
            taskId: task.id,
            userId: liveTask.assigneeId ?? task.id,
            minutes: elapsedMinutes,
            note: '[Auto-paused] Timer stopped automatically — estimated time exceeded.',
            loggedAt: new Date(),
          },
        }).catch(() => {});
        // Clear the timer
        const newTotal = totalAfter + elapsedMinutes;
        await this.prisma.task.update({
          where: { id: task.id },
          data: { timerStartedAt: null, totalLoggedMinutes: newTotal },
        }).catch(() => {});
      }

      const recipients = new Set<string>();
      if (task.assigneeId) recipients.add(task.assigneeId);
      if (task.createdById) recipients.add(task.createdById);

      for (const userId of recipients) {
        await this.notifications.notify(userId, 'effort_budget_exceeded', {
          taskId: task.id,
          taskTitle: task.title,
          estimateMinutes,
          loggedMinutes: totalAfter,
        });
      }
    }
  }

  // --- v1.1: Task dependencies (docs/02-DATA-MODEL.md §3) ---

  async listDependencies(user: AccessTokenPayload, taskId: string) {
    await this.get(user, taskId);
    const deps = await this.prisma.taskDependency.findMany({
      where: { taskId },
      include: {
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: { select: { id: true, key: true, label: true, color: true, category: true } },
          },
        },
      },
    });
    return deps.map((d) => ({
      ...d,
      depends_on_task: d.dependsOnTask
        ? {
            id: d.dependsOnTask.id,
            title: d.dependsOnTask.title,
            status: d.dependsOnTask.status,
          }
        : null,
    }));
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
    assertDepartmentScope(user, step.task.departmentId, step.task.assigneeId);

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
    recurrenceIndex?: number;
    recurrenceParentId?: string | null;
    estimateValue?: number | null;
    estimateUnit?: any;
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
    const nextIndex = (task.recurrenceIndex ?? 1) + 1;
    const parentId = task.recurrenceParentId ?? task.id;

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
        recurrenceIndex: nextIndex,
        recurrenceParentId: parentId,
        estimateValue: task.estimateValue ?? null,
        estimateUnit: task.estimateUnit ?? 'hours',
      },
    });
    await this.logActivity(newTask.id, task.createdById, 'created', { recurrenceOf: task.id, recurrenceIndex: nextIndex });
    if (newTask.assigneeId) {
      await this.notifications.notify(newTask.assigneeId, 'task_assigned', { taskId: newTask.id, taskTitle: newTask.title });
    }
    return newTask;
  }

  /** Explicitly spawns the next occurrence ahead of time on user request */
  async spawnNextOccurrence(user: AccessTokenPayload, taskId: string) {
    const task = await this.get(user, taskId);
    if (!task.isRecurring || !task.recurrenceRule) {
      throw new BadRequestException('This task does not have a recurrence rule configured.');
    }
    const created = await this.generateNextOccurrence(task);
    if (!created) {
      throw new BadRequestException('Could not compute next occurrence date for this recurrence rule.');
    }
    return created;
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
    const ids = new Set<string>();

    // Tiptap mention nodes rendered as HTML: <span data-type="mention" data-id="<uuid>">
    // We match just the UUID attr value so we don't need a full HTML parser.
    for (const m of body.matchAll(/data-id="([0-9a-f-]{36})"/gi)) {
      ids.add(m[1]);
    }

    // Legacy plain-text @email mentions — kept for backward compat with non-RTE comments.
    const emails = [...body.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((m) => m[1]);
    if (emails.length) {
      const users = await this.prisma.user.findMany({ where: { email: { in: emails } } });
      for (const u of users) ids.add(u.id);
    }

    return [...ids];
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

  /**
   * Bulk action on a set of tasks (plan §1.3) — reassign, transition, or soft-delete (archive).
   * Each task is processed independently: RBAC + department-scope are checked per task so partial
   * success is possible. The response reports how many succeeded and lists per-row errors.
   */
  async bulkAction(
    user: AccessTokenPayload,
    ids: string[],
    action: 'reassign' | 'transition' | 'archive',
    payload: { assignee_id?: string | null; status_id?: string },
  ) {
    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        if (action === 'reassign') {
          await this.assign(user, id, payload.assignee_id ?? null);
        } else if (action === 'transition') {
          if (!payload.status_id) throw new BadRequestException('status_id required for transition');
          await this.transition(user, id, payload.status_id);
        } else if (action === 'archive') {
          const task = await this.prisma.task.findUnique({ where: { id } });
          if (!task) throw new NotFoundException('Task not found');
          assertDepartmentScope(user, task.departmentId, task.assigneeId);
          const canManage = await this.canDirectlyManageTask(user, task);
          if (!canManage) {
            throw new ForbiddenException('Only managers and in-charge roles can directly archive tasks.');
          }
          await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
          await this.logActivity(id, user.sub, 'archived', { bulk: true });
        }
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    return { succeeded, failed: results.length - succeeded, results };
  }
}

