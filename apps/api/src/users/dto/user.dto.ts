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
  @IsArray()
  @IsUUID(undefined, { each: true })
  department_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
