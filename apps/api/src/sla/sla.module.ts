import { Module } from '@nestjs/common';
import { SLAPoliciesController } from './sla-policies.controller';
import { SLAEscalationService } from './sla-escalation.service';
import { OverdueEscalationService } from './overdue-escalation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { HolidayCalendarsModule } from '../holiday-calendars/holiday-calendars.module';

@Module({
  imports: [NotificationsModule, HolidayCalendarsModule],
  controllers: [SLAPoliciesController],
  providers: [SLAEscalationService, OverdueEscalationService],
})
export class SLAModule {}
