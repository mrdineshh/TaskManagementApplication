import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDto {
  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  key!: string;

  @IsString()
  label!: string;

  @IsEnum(CustomFieldType)
  field_type!: CustomFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
