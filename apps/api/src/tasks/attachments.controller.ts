import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { MockStorageService } from '../storage/mock-storage.service';
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

class MockUploadDto {
  @IsString()
  content_base64!: string;
}

@ApiTags('tasks')
@Controller('tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MockStorageService,
  ) {}

  @Post('upload-url')
  @RequirePermission('task.edit')
  async requestUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('taskId') taskId: string,
    @Body() dto: RequestUploadUrlDto,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const storagePath = `attachments/${taskId}/${Date.now()}-${dto.file_name}`;
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
      upload_url: this.storage.buildUploadUrl(storagePath),
    };
  }
}

@ApiTags('tasks')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/confirm')
  @RequirePermission('task.edit')
  async confirm(@Param('id') id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment; // metadata was already finalized at upload-url time in this mock implementation
  }

  @Delete(':id')
  @RequirePermission('task.edit')
  async remove(@Param('id') id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.taskAttachment.delete({ where: { id } });
    return { success: true };
  }
}

/** Mock Cloud Storage endpoint — replaced by real GCS signed URLs once GCP access is available. */
@ApiTags('mock-storage')
@Controller('mock-storage')
export class MockStorageController {
  constructor(private readonly storage: MockStorageService) {}

  @Public()
  @Post(':storagePath')
  upload(@Param('storagePath') storagePath: string, @Body() dto: MockUploadDto) {
    this.storage.write(decodeURIComponent(storagePath), dto.content_base64);
    return { success: true };
  }

  @Public()
  @Get(':storagePath')
  download(@Param('storagePath') storagePath: string, @Res() res: Response) {
    const buffer = this.storage.read(decodeURIComponent(storagePath));
    res.send(buffer);
  }
}
