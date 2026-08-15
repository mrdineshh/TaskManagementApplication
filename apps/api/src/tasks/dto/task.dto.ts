import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsUUID()
  department_id!: string;

  @IsOptional()
  @IsUUID()
  workflow_id?: string;

  @IsOptional()
  @IsUUID()
  priority_id?: string;

  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @IsOptional()
  @IsUUID()
  parent_task_id?: string | null;

  @IsOptional()
  @IsDateString()
  due_date?: string | null;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsObject()
  custom_field_values?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrence_rule?: string; // iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO"

  @IsOptional()
  @IsUUID()
  sla_policy_id?: string | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsUUID()
  priority_id?: string;

  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @IsOptional()
  @IsDateString()
  due_date?: string | null;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsObject()
  custom_field_values?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  sla_policy_id?: string | null;
}

export class AssignTaskDto {
  @IsOptional()
  @IsUUID()
  assignee_id!: string | null;
}

export class TransitionTaskDto {
  @IsUUID()
  to_status_id!: string;

  // Required only when the target WorkflowStatus has requires_hold_reason=true
  // (docs/10-OPEN-DECISIONS.md §H1) — validated in the service, not here, since that's
  // conditional on the target status rather than a fixed rule.
  @IsOptional()
  @IsUUID()
  on_hold_reason_id?: string;
}

export class SubmitEstimateDto {
  @IsNumber()
  @Min(0.01)
  value!: number;

  @IsIn(['hours', 'days'])
  unit!: 'hours' | 'days';
}

export class UpdateTimeLogDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsDateString()
  logged_at?: string;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}

export class TaskListQueryDto {
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  status_id?: string;

  // A single UUID (the common case) or a comma-separated list — the latter powers the "whole
  // team" drill-down links (docs/10-OPEN-DECISIONS.md §M5: a manager's aggregate Overdue/Over
  // budget count links to every direct report at once, not one person). Always normalized to
  // an array so TasksService only has one shape to handle.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsUUID('all', { each: true })
  assignee_id?: string[];

  @IsOptional()
  @IsUUID()
  priority_id?: string;

  @IsOptional()
  @IsUUID()
  parent_task_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

  // Drill-down filters (docs/10-OPEN-DECISIONS.md §M5) — same business-day-overdue / logged-vs-
  // estimated-budget definitions the team dashboard's stat counts already use, so clicking a
  // dashboard's "Overdue: N" number and landing here shows exactly N tasks, not an
  // approximation. Both computed in-memory (not a DB predicate — the accessor's holiday
  // calendar is per-assignee), so combining either with cursor pagination is out of scope for
  // now; see TasksService.list().
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  over_budget?: boolean;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class CreateTimeLogDto {
  @IsInt()
  @Min(1)
  minutes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  logged_at?: string;
}

export class CreateTaskDependencyDto {
  @IsUUID()
  depends_on_task_id!: string;

  @IsString()
  type!: 'blocks' | 'relates_to';
}
