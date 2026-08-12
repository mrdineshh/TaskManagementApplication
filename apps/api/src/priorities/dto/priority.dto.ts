import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CreatePriorityDto {
  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  key!: string;

  @IsString()
  label!: string;

  @IsInt()
  @Min(0)
  display_order!: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdatePriorityDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
