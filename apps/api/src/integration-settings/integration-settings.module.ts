import { Module } from '@nestjs/common';
import { IntegrationSettingsController } from './integration-settings.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [IntegrationSettingsController],
})
export class IntegrationSettingsModule {}
