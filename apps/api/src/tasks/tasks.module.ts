import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { CommentsController } from './comments.controller';
import { ApprovalStepsController } from './approval-steps.controller';
import {
  AttachmentsController,
  MockStorageController,
  TaskAttachmentsController,
} from './attachments.controller';
import { TasksService } from './tasks.service';
import { MockStorageService } from '../storage/mock-storage.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    TasksController,
    CommentsController,
    ApprovalStepsController,
    TaskAttachmentsController,
    AttachmentsController,
    MockStorageController,
  ],
  providers: [TasksService, MockStorageService],
})
export class TasksModule {}
