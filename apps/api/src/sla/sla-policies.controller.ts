import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateSLAPolicyDto, UpdateSLAPolicyDto } from './dto/sla-policy.dto';

/** SLA policy management (docs/05-FEATURES.md §2.2) — Admins define response/resolution times and escalation rules per department. */
@ApiTags('sla')
@Controller('sla-policies')
export class SLAPoliciesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('sla.view')
  list(@Query('department_id') departmentId?: string) {
    return this.prisma.sLAPolicy.findMany({
      where: departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {},
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @RequirePermission('sla.manage')
  create(@Body() dto: CreateSLAPolicyDto) {
    return this.prisma.sLAPolicy.create({
      data: {
        name: dto.name,
        departmentId: dto.department_id ?? null,
        responseTimeMinutes: dto.response_time_minutes,
        resolutionTimeMinutes: dto.resolution_time_minutes,
        escalationRules: (dto.escalation_rules ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  @Patch(':id')
  @RequirePermission('sla.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateSLAPolicyDto) {
    const existing = await this.prisma.sLAPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    return this.prisma.sLAPolicy.update({
      where: { id },
      data: {
        name: dto.name,
        responseTimeMinutes: dto.response_time_minutes,
        resolutionTimeMinutes: dto.resolution_time_minutes,
        escalationRules: dto.escalation_rules as unknown as Prisma.InputJsonValue | undefined,
        isActive: dto.is_active,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('sla.manage')
  async deactivate(@Param('id') id: string) {
    const existing = await this.prisma.sLAPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    await this.prisma.sLAPolicy.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
