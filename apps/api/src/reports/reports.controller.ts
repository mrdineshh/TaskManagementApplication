import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ReportsService } from './reports.service';
import { CreateReportDto, PreviewReportDto, UpdateReportDto } from './dto/report.dto';

/** Saved report CRUD + ad-hoc preview/run (docs/05-FEATURES.md §3.1/§3.3). */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission('report.view')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.reports.list(user);
  }

  @Get(':id')
  @RequirePermission('report.view')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.reports.getVisible(user, id);
  }

  @Post()
  @RequirePermission('report.create')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('report.create')
  update(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reports.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('report.create')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.reports.remove(user, id);
  }

  @Post('preview')
  @RequirePermission('report.view')
  preview(@CurrentUser() user: AccessTokenPayload, @Body() dto: PreviewReportDto) {
    return this.reports.preview(user, dto.config);
  }

  @Get(':id/run')
  @RequirePermission('report.view')
  run(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.reports.run(user, id);
  }
}
