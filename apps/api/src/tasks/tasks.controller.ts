import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import {
  AssignTaskDto,
  CreateCommentDto,
  CreateTaskDependencyDto,
  CreateTaskDto,
  CreateTimeLogDto,
  TaskListQueryDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto/task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('task.view')
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: TaskListQueryDto) {
    return this.tasks.list(user, query);
  }

  @Post()
  @RequirePermission('task.create')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Get(':id')
  @RequirePermission('task.view')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('task.edit')
  update(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('task.delete')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }

  @Post(':id/assign')
  @RequirePermission('task.assign')
  assign(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(user, id, dto.assignee_id ?? null);
  }

  @Post(':id/transition')
  transition(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: TransitionTaskDto) {
    // Permission is per-transition (WorkflowTransition.required_permission), checked in the service —
    // no single @RequirePermission fits here, per 03-RBAC-AUTH.md §2.3.
    return this.tasks.transition(user, id, dto.to_status_id);
  }

  @Get(':id/activity')
  @RequirePermission('task.view')
  activity(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.activity(user, id);
  }

  @Get(':id/comments')
  @RequirePermission('task.view')
  listComments(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.listComments(user, id);
  }

  @Post(':id/comments')
  @RequirePermission('task.comment')
  addComment(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.tasks.addComment(user, id, dto.body);
  }

  // --- v1.1: Time tracking (docs/04-API-SPEC.md §5 v1.1 additions) ---

  @Get(':id/time-logs')
  @RequirePermission('task.view')
  listTimeLogs(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.listTimeLogs(user, id);
  }

  @Post(':id/time-logs')
  @RequirePermission('task.edit')
  addTimeLog(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: CreateTimeLogDto) {
    return this.tasks.addTimeLog(user, id, dto.minutes, dto.note, dto.logged_at);
  }

  // --- v1.1: Task dependencies ---

  @Get(':id/dependencies')
  @RequirePermission('task.view')
  listDependencies(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.listDependencies(user, id);
  }

  @Post(':id/dependencies')
  @RequirePermission('task.edit')
  addDependency(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: CreateTaskDependencyDto) {
    return this.tasks.addDependency(user, id, dto.depends_on_task_id, dto.type);
  }

  @Delete(':id/dependencies/:depId')
  @RequirePermission('task.edit')
  removeDependency(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Param('depId') depId: string) {
    return this.tasks.removeDependency(user, id, depId);
  }

  // --- v1.1: Approval workflows ---

  @Get(':id/approval-steps')
  @RequirePermission('task.view')
  listApprovalSteps(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.listApprovalSteps(user, id);
  }

  @Post(':id/approval-steps')
  submitForApproval(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: TransitionTaskDto) {
    // Equivalent to attempting the guarded transition directly — transition() already creates
    // the ApprovalStep when the target WorkflowTransition has requires_approval set.
    return this.tasks.transition(user, id, dto.to_status_id);
  }
}
