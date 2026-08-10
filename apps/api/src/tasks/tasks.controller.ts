import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import {
  AssignTaskDto,
  CreateCommentDto,
  CreateTaskDto,
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
}
