import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { StorageService } from '../storage/storage.service';
import { MAX_ATTACHMENT_SIZE_BYTES } from '@taskapp/shared-types';

class RequestUploadUrlDto {
  @IsString()
  @MaxLength(255)
  file_name!: string;

  @IsString()
  mime_type!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_SIZE_BYTES)
  size_bytes!: number;
}

@ApiTags('tasks')
@Controller('tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Step 1 of two-step upload (P5-04): validate metadata, create the DB record
   * with `pending` status, and return a V4 signed GCS PUT URL (10 min TTL).
   */
  @Post('upload-url')
  @RequirePermission('task.edit')
  async requestUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('taskId') taskId: string,
    @Body() dto: RequestUploadUrlDto,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const storagePath = `attachments/${taskId}/${Date.now()}-${dto.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { uploadUrl } = await this.storage.initUpload({
      storagePath,
      contentType: dto.mime_type,
      sizeBytes: dto.size_bytes,
    });

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById: user.sub,
        fileName: dto.file_name,
        storagePath,
        mimeType: dto.mime_type,
        sizeBytes: BigInt(dto.size_bytes),
      },
    });

    return {
      attachment_id: attachment.id,
      upload_url: uploadUrl,
    };
  }
}

@ApiTags('tasks')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Step 2: after client PUTs to GCS, call this to verify the object exists
   * and get a signed download URL.
   */
  @Post(':id/confirm')
  @RequirePermission('task.edit')
  async confirm(@Param('id') id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const result = await this.storage.verifyUpload(attachment.storagePath);
    if (!result.exists) {
      throw new NotFoundException('File was not found in storage — upload may have failed');
    }

    return { ...attachment, sizeBytes: attachment.sizeBytes.toString() };
  }

  /** Returns a short-lived signed download URL (15 min). */
  @Get(':id/download-url')
  @RequirePermission('task.view')
  async getDownloadUrl(@Param('id') id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const url = await this.storage.getDownloadUrl(attachment.storagePath);
    return { download_url: url };
  }

  @Delete(':id')
  @RequirePermission('task.edit')
  async remove(@Param('id') id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.storage.softDelete(attachment.storagePath);
    await this.prisma.taskAttachment.delete({ where: { id } });
    return { success: true };
  }
}
