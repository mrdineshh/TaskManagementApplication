import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportAggregationService } from './report-aggregation.service';
import { ReportMetricsController } from './report-metrics.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSchedulesController } from './report-schedules.controller';
import { ReportSchedulesService } from './report-schedules.service';
import { ReportScheduleDeliveryService } from './report-schedule-delivery.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [ReportMetricsController, ReportsController, ReportSchedulesController],
  providers: [ReportAggregationService, ReportsService, ReportSchedulesService, ReportScheduleDeliveryService],
})
export class ReportsModule {}
