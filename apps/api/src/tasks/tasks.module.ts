import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { CommentsController } from './comments.controller';
import { ApprovalStepsController } from './approval-steps.controller';
import {
  AttachmentsController,
  TaskAttachmentsController,
} from './attachments.controller';
import { TasksService } from './tasks.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { HolidayCalendarsModule } from '../holiday-calendars/holiday-calendars.module';
import { TimerSweeperService } from './timer-sweeper.service';

@Module({
  imports: [NotificationsModule, HolidayCalendarsModule],
  controllers: [
    TasksController,
    CommentsController,
    ApprovalStepsController,
    TaskAttachmentsController,
    AttachmentsController,
    // MockStorageController removed — using real GCS (P5-04)
  ],
  providers: [TasksService, StorageService, TimerSweeperService],
})
export class TasksModule {}
