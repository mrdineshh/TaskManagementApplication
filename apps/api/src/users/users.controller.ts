import {
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
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('user.view')
  async list(
    @Query('department_id') departmentId?: string,
    @Query('is_active') isActive?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(departmentId
          ? {
              OR: [
                { primaryDepartmentId: departmentId },
                { departments: { some: { departmentId } } },
              ],
            }
          : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      include: { departments: true, roles: { include: { role: true } } },
      orderBy: { fullName: 'asc' },
    });
    return users.map(this.toDto);
  }

  @Get(':id')
  @RequirePermission('user.view')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { departments: true, roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  @Post()
  @RequirePermission('user.manage')
  async invite(@Body() dto: InviteUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.full_name,
        primaryDepartmentId: dto.primary_department_id,
        workCountry: dto.work_country,
        workState: dto.work_state,
        managerId: dto.manager_id,
        authProvider: 'google',
      },
    });
    if (dto.role_ids?.length) {
      await this.prisma.userRole.createMany({
        data: dto.role_ids.map((roleId) => ({ userId: user.id, roleId })),
        skipDuplicates: true,
      });
    }
    return this.get(user.id);
  }

  @Patch(':id')
  @RequirePermission('user.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.full_name,
        primaryDepartmentId: dto.primary_department_id,
        workCountry: dto.work_country,
        workState: dto.work_state,
        managerId: dto.manager_id,
        isActive: dto.is_active,
      },
    });

    if (dto.department_ids) {
      await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
      await this.prisma.userDepartment.createMany({
        data: dto.department_ids.map((departmentId) => ({ userId: id, departmentId })),
        skipDuplicates: true,
      });
    }
    return this.get(id);
  }

  @Delete(':id')
  @RequirePermission('user.manage')
  async deactivate(@Param('id') id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  private toDto(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    primaryDepartmentId: string;
    workCountry: string;
    workState: string;
    managerId: string | null;
    authProvider: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    departments: { departmentId: string }[];
    roles: { role: { id: string; name: string } }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      primary_department_id: user.primaryDepartmentId,
      work_country: user.workCountry,
      work_state: user.workState,
      manager_id: user.managerId,
      department_ids: user.departments.map((d) => d.departmentId),
      auth_provider: user.authProvider,
      is_active: user.isActive,
      last_login_at: user.lastLoginAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      roles: user.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
    };
  }
}
