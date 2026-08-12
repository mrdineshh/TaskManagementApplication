import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';

/** Department-extensibility mechanism (docs/02-DATA-MODEL.md §4, 04-API-SPEC.md §6). */
@ApiTags('custom-fields')
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('custom_field.view')
  list(@Query('department_id') departmentId?: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {},
      orderBy: { displayOrder: 'asc' },
    });
  }

  @Post()
  @RequirePermission('custom_field.manage')
  create(@Body() dto: CreateCustomFieldDto) {
    if (['select', 'multi_select'].includes(dto.field_type) && !dto.options?.length) {
      throw new BadRequestException('options is required for select/multi_select fields');
    }
    return this.prisma.customFieldDefinition.create({
      data: {
        departmentId: dto.department_id ?? null,
        key: dto.key,
        label: dto.label,
        fieldType: dto.field_type,
        options: dto.options ?? undefined,
        isRequired: dto.is_required ?? false,
        displayOrder: dto.display_order ?? 0,
      },
    });
  }

  @Patch(':id')
  @RequirePermission('custom_field.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomFieldDto) {
    const existing = await this.prisma.customFieldDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Custom field not found');
    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        options: dto.options,
        isRequired: dto.is_required,
        displayOrder: dto.display_order,
        isActive: dto.is_active,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('custom_field.manage')
  async deactivate(@Param('id') id: string) {
    const existing = await this.prisma.customFieldDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Custom field not found');
    await this.prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
