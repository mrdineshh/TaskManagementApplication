import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength, ValidateNested } from 'class-validator';

class EscalationRuleDto {
  @IsNumber()
  @Min(1)
  @Max(200)
  percent_elapsed!: number;

  @IsString()
  notify!: 'assignee' | 'assignee_manager';
}

export class CreateSLAPolicyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsInt()
  @Min(1)
  response_time_minutes!: number;

  @IsInt()
  @Min(1)
  resolution_time_minutes!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationRuleDto)
  escalation_rules?: EscalationRuleDto[];
}

export class UpdateSLAPolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  response_time_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  resolution_time_minutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationRuleDto)
  escalation_rules?: EscalationRuleDto[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
