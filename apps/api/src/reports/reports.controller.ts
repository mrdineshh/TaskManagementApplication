import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { reportExportFormats, type ReportExportFormat } from '@taskapp/shared-types';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ReportsService } from './reports.service';
import { CreateReportDto, PreviewReportDto, UpdateReportDto } from './dto/report.dto';

function parseFormat(format?: string): ReportExportFormat {
  if (!format || !(reportExportFormats as readonly string[]).includes(format)) {
    throw new BadRequestException(`format must be one of: ${reportExportFormats.join(', ')}`);
  }
  return format as ReportExportFormat;
}

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

  @Get(':id/export')
  @RequirePermission('report.export')
  async exportSaved(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType, extension } = await this.reports.exportSaved(user, id, parseFormat(format));
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="report.${extension}"` });
    res.send(buffer);
  }

  @Post('preview/export')
  @RequirePermission('report.export')
  async exportPreview(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: PreviewReportDto,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType, extension } = await this.reports.exportPreview(user, dto.config, parseFormat(format));
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="report-preview.${extension}"` });
    res.send(buffer);
  }
}
