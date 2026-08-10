import { Module } from '@nestjs/common';
import { ReportAggregationService } from './report-aggregation.service';
import { ReportMetricsController } from './report-metrics.controller';

@Module({
  controllers: [ReportMetricsController],
  providers: [ReportAggregationService],
})
export class ReportsModule {}
