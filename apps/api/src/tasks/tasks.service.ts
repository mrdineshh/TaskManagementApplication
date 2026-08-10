import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.service';
import { assertDepartmentScope, departmentScopeWhere } from '../common/scope.util';
import { decodeCursor, encodeCursor } from '../common/cursor-pagination.util';
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
      ...(query.assignee_id ? { assigneeId: query.assignee_id } : {}),
      ...(query.priority_id ? { priorityId: query.priority_id } : {}),
      ...(query.parent_task_id !== undefined ? { parentTaskId: query.parent_task_id } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };

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

  async get(user: AccessTokenPayload, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        customFieldValues: true,
        subtasks: { where: { deletedAt: null } },
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

  /** Validates and applies a WorkflowTransition (docs/03-RBAC-AUTH.md §2.3, 04-API-SPEC.md §5). */
  async transition(user: AccessTokenPayload, id: string, toStatusId: string) {
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
    if (transition.requiresApproval) {
      // Approval workflows are v1.1 scope (docs/05-FEATURES.md §2.5) — not yet built.
      throw new BadRequestException('This transition requires approval, which is not yet implemented (v1.1)');
    }

    const toStatus = await this.prisma.workflowStatus.findUniqueOrThrow({ where: { id: toStatusId } });
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        statusId: toStatusId,
        completedAt: toStatus.category === 'done' ? new Date() : null,
      },
    });

    await this.logActivity(id, user.sub, 'status_changed', { from: existing.statusId, to: toStatusId });

    if (task.assigneeId) {
      await this.notifications.notify(task.assigneeId, 'status_changed', { taskId: id, taskTitle: task.title });
    }
    return task;
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
