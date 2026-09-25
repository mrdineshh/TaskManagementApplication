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

    const targetHeadUserId = dto.head_user_id === undefined ? undefined : (dto.head_user_id || null);

    if (targetHeadUserId !== undefined) {
      if (targetHeadUserId) {
        const head = await this.prisma.user.findUnique({ where: { id: targetHeadUserId } });
        if (!head) throw new BadRequestException('head_user_id does not match an existing user');
        const alreadyHeadsElsewhere = await this.prisma.department.findFirst({
          where: { headUserId: targetHeadUserId, id: { not: id } },
        });
        if (alreadyHeadsElsewhere) {
          throw new BadRequestException(`This user is already Head of "${alreadyHeadsElsewhere.name}"`);
        }
      }

      // Synchronize the Head role in user_roles
      const prevHeadId = existing.headUserId;
      const newHeadId = targetHeadUserId;

      if (prevHeadId !== newHeadId) {
        let headRole = await this.prisma.role.findFirst({ where: { name: 'Head' } });
        if (!headRole) {
          headRole = await this.prisma.role.create({
            data: { name: 'Head', isSystemRole: false },
          });
        }
        const employeeRole = await this.prisma.role.findFirst({ where: { name: 'Employee' } });

        // 1. If previous head is being replaced/unassigned, remove Head role if they do not head any other department
        if (prevHeadId) {
          const otherDeptsHeaded = await this.prisma.department.count({
            where: { headUserId: prevHeadId, id: { not: id } },
          });
          if (otherDeptsHeaded === 0 && headRole) {
            await this.prisma.userRole.deleteMany({
              where: { userId: prevHeadId, roleId: headRole.id },
            });
            const remainingCount = await this.prisma.userRole.count({ where: { userId: prevHeadId } });
            if (remainingCount === 0 && employeeRole) {
              const prevUser = await this.prisma.user.findUnique({ where: { id: prevHeadId } });
              await this.prisma.userRole.create({
                data: {
                  userId: prevHeadId,
                  roleId: employeeRole.id,
                  departmentOverride: prevUser?.primaryDepartmentId ?? id,
                },
              });
            }
          }
        }

        // 2. If new head is assigned, assign Head role and clean up default Employee role
        if (newHeadId && headRole) {
          await this.prisma.userRole.upsert({
            where: { userId_roleId: { userId: newHeadId, roleId: headRole.id } },
            update: { departmentOverride: id },
            create: { userId: newHeadId, roleId: headRole.id, departmentOverride: id },
          });

          // Clean up Employee role so Head is the active role
          if (employeeRole) {
            await this.prisma.userRole.deleteMany({
              where: { userId: newHeadId, roleId: employeeRole.id },
            });
          }
        }
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
        slug: dto.slug,
        description: dto.description,
        isActive: dto.is_active,
        headUserId: targetHeadUserId === undefined ? undefined : targetHeadUserId,
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
