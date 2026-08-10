import { Module } from '@nestjs/common';
import { SLAPoliciesController } from './sla-policies.controller';
import { SLAEscalationService } from './sla-escalation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SLAPoliciesController],
  providers: [SLAEscalationService],
})
export class SLAModule {}
