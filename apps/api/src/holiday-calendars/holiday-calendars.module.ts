import { Module } from '@nestjs/common';
import { HolidayCalendarsController } from './holiday-calendars.controller';

@Module({
  controllers: [HolidayCalendarsController],
})
export class HolidayCalendarsModule {}
