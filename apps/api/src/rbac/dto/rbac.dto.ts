import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permission_keys?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permission_keys?: string[];
}

export class AssignRoleDto {
  @IsUUID()
  role_id!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
