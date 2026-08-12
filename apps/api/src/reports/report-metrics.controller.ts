import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { reportChartTypes, reportDimensions } from '@taskapp/shared-types';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { REPORT_METRIC_DEFINITIONS } from './report-metrics.registry';

/** Report builder catalog (docs/05-FEATURES.md §3.3) — metrics/dimensions/chart types available to pick from. */
@ApiTags('reports')
@Controller('report-metrics')
export class ReportMetricsController {
  @Get()
  @RequirePermission('report.view')
  list() {
    return {
      metrics: REPORT_METRIC_DEFINITIONS,
      dimensions: reportDimensions,
      chart_types: reportChartTypes,
    };
  }
}
