import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  full_name!: string;

  @IsUUID()
  primary_department_id!: string;

  // Work location (docs/10-OPEN-DECISIONS.md §G2) — required at creation, drives which
  // HolidayCalendar governs this user's business-day/overdue math.
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  work_country!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  work_state!: string;

  // "Reports to" (docs/10-OPEN-DECISIONS.md §G1) — optional since Heads and Management don't
  // report to a Manager within the department hierarchy.
  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  role_ids?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  full_name?: string;

  @IsOptional()
  @IsUUID()
  primary_department_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  work_country?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  work_state?: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  department_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
