import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
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

  @IsOptional()
  @IsUUID()
  assignee_id?: string;

  @IsOptional()
  @IsUUID()
  priority_id?: string;

  @IsOptional()
  @IsUUID()
  parent_task_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

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
