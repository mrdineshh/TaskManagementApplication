import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { WorkflowStatusCategory } from '@prisma/client';

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateWorkflowStatusDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  key!: string;

  @IsString()
  label!: string;

  @IsEnum(WorkflowStatusCategory)
  category!: WorkflowStatusCategory;

  @IsInt()
  @Min(0)
  display_order!: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateWorkflowStatusDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsEnum(WorkflowStatusCategory)
  category?: WorkflowStatusCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateWorkflowTransitionDto {
  @IsUUID()
  from_status_id!: string;

  @IsUUID()
  to_status_id!: string;

  @IsOptional()
  @IsString()
  required_permission?: string | null;

  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;
}
