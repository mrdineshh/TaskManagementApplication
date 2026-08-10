import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { reportExportFormats, reportFrequencies } from '@taskapp/shared-types';

const SEND_AT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateReportScheduleDto {
  @IsIn(reportFrequencies)
  frequency!: (typeof reportFrequencies)[number];

  @Matches(SEND_AT_PATTERN, { message: 'send_at must be HH:MM' })
  send_at!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day_of_month?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipient_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipient_role_ids?: string[];

  @IsIn(reportExportFormats)
  export_format!: (typeof reportExportFormats)[number];
}

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsIn(reportFrequencies)
  frequency?: (typeof reportFrequencies)[number];

  @IsOptional()
  @Matches(SEND_AT_PATTERN, { message: 'send_at must be HH:MM' })
  send_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day_of_month?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipient_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipient_role_ids?: string[];

  @IsOptional()
  @IsIn(reportExportFormats)
  export_format?: (typeof reportExportFormats)[number];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
