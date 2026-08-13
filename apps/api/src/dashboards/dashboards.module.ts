import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { HolidayCalendarsModule } from '../holiday-calendars/holiday-calendars.module';

@Module({
  imports: [HolidayCalendarsModule],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
