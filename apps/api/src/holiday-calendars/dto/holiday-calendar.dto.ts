import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

// CSV upload (docs/10-OPEN-DECISIONS.md §M9) — parsed client-side into rows, posted as JSON
// rather than a multipart file upload, so this DTO validates the same way as any other body.
export class BulkCreateHolidaysDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateHolidayDto)
  holidays!: CreateHolidayDto[];
}
