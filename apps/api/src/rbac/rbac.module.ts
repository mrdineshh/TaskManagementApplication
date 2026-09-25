import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RolesController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
