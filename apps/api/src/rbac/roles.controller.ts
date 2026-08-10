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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from './dto/rbac.dto';

/** Roles & Permissions — the RBAC configuration surface (docs/04-API-SPEC.md §4). */
@ApiTags('rbac')
@Controller()
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermission('role.manage')
  async list() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map(this.toDto);
  }

  @Get('roles/:id')
  @RequirePermission('role.manage')
  async get(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.toDto(role);
  }

  @Post('roles')
  @RequirePermission('role.manage')
  async create(@Body() dto: CreateRoleDto) {
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.department_id ?? null,
      },
    });
    if (dto.permission_keys?.length) {
      await this.setPermissions(role.id, dto.permission_keys);
    }
    return this.get(role.id);
  }

  @Patch('roles/:id')
  @RequirePermission('role.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.department_id === undefined ? undefined : dto.department_id,
      },
    });
    if (dto.permission_keys) {
      await this.setPermissions(id, dto.permission_keys);
    }
    return this.get(id);
  }

  @Delete('roles/:id')
  @RequirePermission('role.manage')
  async remove(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole && role.name === 'Admin') {
      throw new BadRequestException('The Admin system role cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  @Get('permissions')
  @RequirePermission('role.manage')
  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  @Post('users/:id/roles')
  @RequirePermission('role.manage')
  async assignToUser(@Param('id') userId: string, @Body() dto: AssignRoleDto) {
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: dto.role_id } },
      update: { departmentOverride: dto.department_id },
      create: { userId, roleId: dto.role_id, departmentOverride: dto.department_id },
    });
  }

  @Delete('users/:id/roles/:roleId')
  @RequirePermission('role.manage')
  async removeFromUser(@Param('id') userId: string, @Param('roleId') roleId: string) {
    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
    return { success: true };
  }

  private async setPermissions(roleId: string, permissionKeys: string[]) {
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  private toDto(role: {
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    departmentId: string | null;
    permissions: { permission: { key: string } }[];
  }) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      is_system_role: role.isSystemRole,
      department_id: role.departmentId,
      permission_keys: role.permissions.map((p) => p.permission.key),
    };
  }
}
