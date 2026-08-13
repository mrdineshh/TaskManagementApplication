import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
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

    if (dto.head_user_id) {
      const head = await this.prisma.user.findUnique({ where: { id: dto.head_user_id } });
      if (!head) throw new BadRequestException('head_user_id does not match an existing user');
      const alreadyHeadsElsewhere = await this.prisma.department.findFirst({
        where: { headUserId: dto.head_user_id, id: { not: id } },
      });
      if (alreadyHeadsElsewhere) {
        throw new BadRequestException(`This user is already Head of "${alreadyHeadsElsewhere.name}"`);
      }
    }

    // Explicit field mapping, not `data: dto` — the DTO's snake_case keys (is_active,
    // head_user_id) don't match Prisma's camelCase field names, so passing dto straight
    // through silently no-ops those fields (Prisma rejects unknown keys at runtime; hit this
    // live as is_active never actually persisting through this endpoint). Note this is a
    // write-side issue only — reads are fine as-is, since SnakeCaseResponseInterceptor
    // (app.module.ts) already converts every response's camelCase keys to snake_case.
    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.is_active,
        headUserId: dto.head_user_id,
      },
    });
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
