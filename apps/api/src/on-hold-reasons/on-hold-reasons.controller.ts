import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateOnHoldReasonDto, UpdateOnHoldReasonDto } from './dto/on-hold-reason.dto';

/** Admin-configurable On-Hold reasons (docs/10-OPEN-DECISIONS.md §H1) — org-wide, not
 * department-scoped. Picked by the assignee when moving a task into a status flagged
 * WorkflowStatus.requiresHoldReason (see tasks.service.ts's transition()). */
@ApiTags('on-hold-reasons')
@Controller('on-hold-reasons')
export class OnHoldReasonsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('on_hold_reason.view')
  list() {
    return this.prisma.onHoldReason.findMany({ orderBy: { label: 'asc' } });
  }

  @Post()
  @RequirePermission('on_hold_reason.manage')
  create(@Body() dto: CreateOnHoldReasonDto) {
    return this.prisma.onHoldReason.create({ data: dto });
  }

  @Patch(':id')
  @RequirePermission('on_hold_reason.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateOnHoldReasonDto) {
    const existing = await this.prisma.onHoldReason.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('On-hold reason not found');
    // Explicit mapping, not `data: dto` — same snake_case/camelCase mismatch documented in
    // departments.controller.ts's update().
    return this.prisma.onHoldReason.update({
      where: { id },
      data: { label: dto.label, isActive: dto.is_active },
    });
  }

  @Delete(':id')
  @RequirePermission('on_hold_reason.manage')
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.onHoldReason.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('On-hold reason not found');
    // Soft-deactivate, not a hard delete — tasks may still reference this reason (Task.onHoldReasonId
    // is ON DELETE SET NULL, but preserving history in existing tasks' activity logs matters more
    // than allowing true deletion; same reasoning as Department/PriorityDefinition's is_active flag).
    await this.prisma.onHoldReason.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
