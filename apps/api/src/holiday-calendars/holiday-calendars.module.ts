import { Module } from '@nestjs/common';
import { HolidayCalendarsController } from './holiday-calendars.controller';
import { HolidayCalendarsService } from './holiday-calendars.service';

@Module({
  controllers: [HolidayCalendarsController],
  providers: [HolidayCalendarsService],
  exports: [HolidayCalendarsService],
})
export class HolidayCalendarsModule {}
