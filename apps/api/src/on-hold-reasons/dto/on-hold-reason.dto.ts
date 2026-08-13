import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOnHoldReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;
}

export class UpdateOnHoldReasonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
