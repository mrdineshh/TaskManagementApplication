import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { HolidayCalendarsModule } from '../holiday-calendars/holiday-calendars.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [HolidayCalendarsModule, RbacModule],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
