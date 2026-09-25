import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import {
  AssignTaskDto,
  BulkTaskActionDto,
  CreateCommentDto,
  CreateTaskDependencyDto,
  CreateTaskDto,
  CreateTimeLogDto,
  ReviewActionDto,
  SubmitEstimateDto,
  TaskListQueryDto,
  TransitionTaskDto,
  UpdateTaskDto,
  UpdateTimeLogDto,
  CreateTaskActionRequestDto,
  DecideTaskActionRequestDto,
  ResubmitReviewDto,
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

  /**
   * Timesheet — aggregated time-log summary per task. Employees see only their own tasks;
   * managers/admins see all tasks, optionally filtered by department, user, or date range.
   * Used by the Timeline page Timesheet tab.
   */
  @Get('timesheet')
  @RequirePermission('task.view')
  timesheet(
    @CurrentUser() user: AccessTokenPayload,
    @Query('department_id') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.tasks.listAllTimeLogs(user, { department_id: departmentId, from, to, user_id: userId });
  }

  /**
   * Per-employee timesheet detail — all tasks + expanded time-log entries for a single user.
   * Employees can only access their own ID; managers/admins can access any user.
   * Route must be declared before /:id so NestJS doesn't confuse the prefix.
   */
  @Get('timesheet/employee/:userId')
  @RequirePermission('task.view')
  employeeTimesheetDetail(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId') targetUserId: string,
    @Query('department_id') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tasks.employeeTimesheetDetail(user, targetUserId, { department_id: departmentId, from, to });
  }

  @Post()
  @RequirePermission('task.create')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  /**
   * Bulk action (plan §1.3) — processes reassign/transition/archive on multiple task IDs.
   * Each task is individually checked for RBAC + department scope inside the service, so
   * partial-success responses are possible. Route order matters: NestJS matches `/bulk`
   * before `/:id` since this route is declared first.
   */
  @Post('bulk')
  @RequirePermission('task.edit')
  bulk(@CurrentUser() user: AccessTokenPayload, @Body() dto: BulkTaskActionDto) {
    return this.tasks.bulkAction(user, dto.ids, dto.action, {
      assignee_id: dto.assignee_id,
      status_id: dto.status_id,
    });
  }

  @Get('archived')
  @RequirePermission('task.view')
  listArchived(
    @CurrentUser() user: AccessTokenPayload,
    @Query('department_id') departmentId?: string,
    @Query('q') query?: string,
  ) {
    return this.tasks.listArchived(user, departmentId, query);
  }

  @Get('action-requests/pending')
  listPendingActionRequests(@CurrentUser() user: AccessTokenPayload) {
    return this.tasks.listPendingActionRequests(user);
  }

  @Post('action-requests/:id/decide')
  decideActionRequest(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: DecideTaskActionRequestDto,
  ) {
    return this.tasks.decideActionRequest(user, id, dto.decision, dto.reviewer_note);
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

  @Post(':id/archive')
  archive(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.archive(user, id);
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.unarchive(user, id);
  }

  @Delete(':id/permanent')
  permanentDelete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.permanentDelete(user, id);
  }

  @Post(':id/action-requests')
  requestAction(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateTaskActionRequestDto,
  ) {
    return this.tasks.requestAction(user, id, dto.action_type, dto.reason);
  }

  @Get(':id/action-request')
  @RequirePermission('task.view')
  getActionRequest(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.getActionRequestForTask(user, id);
  }

  @Post(':id/assign')
  assign(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(user, id, dto.assignee_id ?? null);
  }

  @Post(':id/transition')
  transition(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: TransitionTaskDto) {
    // Permission is per-transition (WorkflowTransition.required_permission), checked in the service —
    // no single @RequirePermission fits here, per 03-RBAC-AUTH.md §2.3.
    return this.tasks.transition(user, id, dto.to_status_id, dto.on_hold_reason_id);
  }

  /** Effort estimation (docs/10-OPEN-DECISIONS.md §H2) — self-service by the assignee, own
   * permission gate lives inside the service (assignee-only, or task.override_locked_edits). */
  @Post(':id/estimate')
  @RequirePermission('task.edit')
  submitEstimate(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: SubmitEstimateDto) {
    return this.tasks.submitEstimate(user, id, dto.value, dto.unit);
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

  /** 30-minute self-edit window + Admin override (docs/10-OPEN-DECISIONS.md §H3) — enforced in the service. */
  @Patch(':id/time-logs/:logId')
  @RequirePermission('task.edit')
  updateTimeLog(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('logId') logId: string,
    @Body() dto: UpdateTimeLogDto,
  ) {
    return this.tasks.updateTimeLog(user, id, logId, { minutes: dto.minutes, note: dto.note, loggedAt: dto.logged_at });
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

  /**
   * Manager review decision — approve (→ done) or request_changes (→ to-do), with optional reference attachments.
   * Gate is enforced in TasksService.reviewAction() (manager-or-above check).
   */
  @Post(':id/review-action')
  @RequirePermission('task.view')
  reviewAction(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.tasks.reviewAction(user, id, dto.action, dto.comment, dto.attachments);
  }

  @Get(':id/reviews')
  @RequirePermission('task.view')
  getReviews(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.getReviews(user, id);
  }

  @Post(':id/reviews/resubmit')
  @RequirePermission('task.edit')
  resubmitReview(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: ResubmitReviewDto,
  ) {
    return this.tasks.resubmitReview(user, id, dto.note);
  }

  /**
   * Employee clock-out — banks the active session time and stops the timer without
   * changing status (task stays In Progress). Idempotent when timer is already stopped.
   * The timer auto-restarts when the employee moves the task back into In Progress.
   */
  @Post(':id/clock-out')
  @RequirePermission('task.edit')
  clockOut(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.clockOut(user, id);
  }

  /**
   * Employee clock-in — starts or resumes the live session timer on an In Progress task.
   * Idempotent when the timer is already running.
   */
  @Post(':id/clock-in')
  @RequirePermission('task.edit')
  clockIn(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tasks.clockIn(user, id);
  }
}
