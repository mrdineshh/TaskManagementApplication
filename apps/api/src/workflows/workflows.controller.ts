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
import {
  CreateWorkflowDto,
  CreateWorkflowStatusDto,
  CreateWorkflowTransitionDto,
  UpdateWorkflowDto,
  UpdateWorkflowStatusDto,
} from './dto/workflow.dto';

/** Workflow builder — statuses & transitions, fully admin-editable (docs/04-API-SPEC.md §7). */
@ApiTags('workflows')
@Controller()
export class WorkflowsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('workflows')
  @RequirePermission('workflow.view')
  list() {
    return this.prisma.workflowDefinition.findMany();
  }

  @Post('workflows')
  @RequirePermission('workflow.manage')
  create(@Body() dto: CreateWorkflowDto) {
    return this.prisma.workflowDefinition.create({
      data: { name: dto.name, departmentId: dto.department_id ?? null, isDefault: dto.is_default ?? false },
    });
  }

  @Patch('workflows/:id')
  @RequirePermission('workflow.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow not found');
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        departmentId: dto.department_id === undefined ? undefined : dto.department_id,
        isDefault: dto.is_default,
        isActive: dto.is_active,
      },
    });
  }

  @Get('workflows/:id/statuses')
  @RequirePermission('workflow.view')
  statuses(@Param('id') id: string) {
    return this.prisma.workflowStatus.findMany({
      where: { workflowId: id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  @Post('workflows/:id/statuses')
  @RequirePermission('workflow.manage')
  addStatus(@Param('id') workflowId: string, @Body() dto: CreateWorkflowStatusDto) {
    return this.prisma.workflowStatus.create({
      data: {
        workflowId,
        key: dto.key,
        label: dto.label,
        category: dto.category,
        displayOrder: dto.display_order,
        color: dto.color,
      },
    });
  }

  @Patch('statuses/:id')
  @RequirePermission('workflow.manage')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateWorkflowStatusDto) {
    const existing = await this.prisma.workflowStatus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Status not found');
    return this.prisma.workflowStatus.update({
      where: { id },
      data: {
        label: dto.label,
        category: dto.category,
        displayOrder: dto.display_order,
        color: dto.color,
      },
    });
  }

  @Delete('statuses/:id')
  @RequirePermission('workflow.manage')
  async removeStatus(@Param('id') id: string) {
    const inUse = await this.prisma.task.findFirst({
      where: { statusId: id, deletedAt: null },
    });
    if (inUse) {
      throw new BadRequestException('Status is in use by open tasks and cannot be removed');
    }
    await this.prisma.workflowStatus.delete({ where: { id } });
    return { success: true };
  }

  @Get('workflows/:id/transitions')
  @RequirePermission('workflow.view')
  transitions(@Param('id') id: string) {
    return this.prisma.workflowTransition.findMany({ where: { workflowId: id } });
  }

  @Post('workflows/:id/transitions')
  @RequirePermission('workflow.manage')
  addTransition(@Param('id') workflowId: string, @Body() dto: CreateWorkflowTransitionDto) {
    return this.prisma.workflowTransition.create({
      data: {
        workflowId,
        fromStatusId: dto.from_status_id,
        toStatusId: dto.to_status_id,
        requiredPermission: dto.required_permission ?? null,
        requiresApproval: dto.requires_approval ?? false,
      },
    });
  }

  @Delete('transitions/:id')
  @RequirePermission('workflow.manage')
  async removeTransition(@Param('id') id: string) {
    await this.prisma.workflowTransition.delete({ where: { id } });
    return { success: true };
  }
}
