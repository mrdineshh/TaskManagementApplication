import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreatePriorityDto, UpdatePriorityDto } from './dto/priority.dto';

@ApiTags('priorities')
@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('priority.view')
  list(@Query('department_id') departmentId?: string) {
    return this.prisma.priorityDefinition.findMany({
      where: {
        ...(departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {}),
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  @Post()
  @RequirePermission('priority.manage')
  async create(@Body() dto: CreatePriorityDto) {
    if (dto.is_default) {
      await this.prisma.priorityDefinition.updateMany({
        where: { departmentId: dto.department_id ?? null },
        data: { isDefault: false },
      });
    }
    return this.prisma.priorityDefinition.create({
      data: {
        departmentId: dto.department_id ?? null,
        key: dto.key,
        label: dto.label,
        displayOrder: dto.display_order,
        color: dto.color,
        isDefault: dto.is_default ?? false,
      },
    });
  }

  @Patch(':id')
  @RequirePermission('priority.manage')
  async update(@Param('id') id: string, @Body() dto: UpdatePriorityDto) {
    const existing = await this.prisma.priorityDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Priority not found');

    if (dto.is_default) {
      await this.prisma.priorityDefinition.updateMany({
        where: { id: { not: id }, departmentId: existing.departmentId },
        data: { isDefault: false },
      });
    }

    return this.prisma.priorityDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        displayOrder: dto.display_order,
        color: dto.color,
        isDefault: dto.is_default,
        isActive: dto.is_active,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('priority.manage')
  async deactivate(@Param('id') id: string) {
    const existing = await this.prisma.priorityDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Priority not found');

    const inUse = await this.prisma.task.count({ where: { priorityId: id } });
    if (inUse === 0) {
      await this.prisma.priorityDefinition.delete({ where: { id } });
    } else {
      await this.prisma.priorityDefinition.update({ where: { id }, data: { isActive: false } });
    }
    return { success: true };
  }
}
