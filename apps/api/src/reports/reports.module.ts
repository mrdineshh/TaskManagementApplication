import { Module } from '@nestjs/common';
import { ReportAggregationService } from './report-aggregation.service';
import { ReportMetricsController } from './report-metrics.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportMetricsController, ReportsController],
  providers: [ReportAggregationService, ReportsService],
})
export class ReportsModule {}
