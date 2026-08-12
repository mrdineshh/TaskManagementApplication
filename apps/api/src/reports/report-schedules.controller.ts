import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ReportSchedulesService } from './report-schedules.service';
import { CreateReportScheduleDto, UpdateReportScheduleDto } from './dto/report-schedule.dto';

/** Scheduled email delivery for a SavedReport (docs/05-FEATURES.md §3.4). */
@ApiTags('reports')
@Controller('reports/:reportId/schedules')
export class ReportSchedulesController {
  constructor(private readonly schedules: ReportSchedulesService) {}

  @Get()
  @RequirePermission('report.create')
  list(@CurrentUser() user: AccessTokenPayload, @Param('reportId') reportId: string) {
    return this.schedules.list(user, reportId);
  }

  @Post()
  @RequirePermission('report.create')
  create(@CurrentUser() user: AccessTokenPayload, @Param('reportId') reportId: string, @Body() dto: CreateReportScheduleDto) {
    return this.schedules.create(user, reportId, dto);
  }

  @Patch(':scheduleId')
  @RequirePermission('report.create')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('reportId') reportId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateReportScheduleDto,
  ) {
    return this.schedules.update(user, reportId, scheduleId, dto);
  }

  @Delete(':scheduleId')
  @RequirePermission('report.create')
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('reportId') reportId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.schedules.remove(user, reportId, scheduleId);
  }
}
