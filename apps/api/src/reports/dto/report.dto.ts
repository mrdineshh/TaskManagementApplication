import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { reportVisibilities } from '@taskapp/shared-types';

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsIn(reportVisibilities)
  visibility?: (typeof reportVisibilities)[number];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shared_with_role_ids?: string[];
}

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsIn(reportVisibilities)
  visibility?: (typeof reportVisibilities)[number];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shared_with_role_ids?: string[];
}

export class PreviewReportDto {
  @IsObject()
  config!: Record<string, unknown>;
}
