import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHolidayCalendarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  country!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state!: string;
}

export class CreateHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
