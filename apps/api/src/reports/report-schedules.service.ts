import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.service';
import type { CreateReportScheduleDto, UpdateReportScheduleDto } from './dto/report-schedule.dto';

@Injectable()
export class ReportSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Scheduling exposes recipient lists, so — like editing the report itself — only the owner or an Admin may configure it. */
  private async assertManageable(user: AccessTokenPayload, reportId: string) {
    const report = await this.prisma.savedReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.createdById !== user.sub && !user.permissions.includes('report.manage')) {
      throw new ForbiddenException('Only the report owner or an admin can manage its schedules');
    }
    return report;
  }

  async list(user: AccessTokenPayload, reportId: string) {
    await this.assertManageable(user, reportId);
    return this.prisma.reportSchedule.findMany({ where: { savedReportId: reportId }, orderBy: { createdAt: 'asc' } });
  }

  async create(user: AccessTokenPayload, reportId: string, dto: CreateReportScheduleDto) {
    await this.assertManageable(user, reportId);
    return this.prisma.reportSchedule.create({
      data: {
        savedReportId: reportId,
        frequency: dto.frequency,
        sendAt: dto.send_at,
        dayOfWeek: dto.day_of_week ?? null,
        dayOfMonth: dto.day_of_month ?? null,
        recipientUserIds: dto.recipient_user_ids ?? [],
        recipientRoleIds: dto.recipient_role_ids ?? [],
        exportFormat: dto.export_format,
      },
    });
  }

  async update(user: AccessTokenPayload, reportId: string, scheduleId: string, dto: UpdateReportScheduleDto) {
    await this.assertManageable(user, reportId);
    const existing = await this.prisma.reportSchedule.findFirst({ where: { id: scheduleId, savedReportId: reportId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    return this.prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: {
        frequency: dto.frequency,
        sendAt: dto.send_at,
        dayOfWeek: dto.day_of_week,
        dayOfMonth: dto.day_of_month,
        recipientUserIds: dto.recipient_user_ids,
        recipientRoleIds: dto.recipient_role_ids,
        exportFormat: dto.export_format,
        isActive: dto.is_active,
      },
    });
  }

  async remove(user: AccessTokenPayload, reportId: string, scheduleId: string) {
    await this.assertManageable(user, reportId);
    const existing = await this.prisma.reportSchedule.findFirst({ where: { id: scheduleId, savedReportId: reportId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    await this.prisma.reportSchedule.delete({ where: { id: scheduleId } });
    return { success: true };
  }
}
