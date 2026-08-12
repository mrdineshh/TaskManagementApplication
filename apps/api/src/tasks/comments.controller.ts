import { Body, Controller, Delete, ForbiddenException, NotFoundException, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { CreateCommentDto } from './dto/task.dto';

@ApiTags('tasks')
@Controller('comments')
export class CommentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch(':id')
  @RequirePermission('task.comment')
  async edit(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    if (comment.authorId !== user.sub) throw new ForbiddenException('Can only edit your own comment');
    return this.prisma.taskComment.update({ where: { id }, data: { body: dto.body } });
  }

  @Delete(':id')
  @RequirePermission('task.comment')
  async remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    const isOwn = comment.authorId === user.sub;
    const canModerate = user.permissions.includes('task.moderate');
    if (!isOwn && !canModerate) {
      throw new ForbiddenException('Can only delete your own comment (or any, with task.moderate)');
    }
    await this.prisma.taskComment.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
