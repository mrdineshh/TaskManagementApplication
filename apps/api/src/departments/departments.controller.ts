import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('department.view')
  list() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  @RequirePermission('department.manage')
  create(@Body() dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }

  @Patch(':id')
  @RequirePermission('department.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @RequirePermission('department.manage')
  async deactivate(@Param('id') id: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    await this.prisma.department.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
