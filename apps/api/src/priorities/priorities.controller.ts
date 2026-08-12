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
      where: departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {},
      orderBy: { displayOrder: 'asc' },
    });
  }

  @Post()
  @RequirePermission('priority.manage')
  create(@Body() dto: CreatePriorityDto) {
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
    await this.prisma.priorityDefinition.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
