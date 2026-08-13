import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { SnakeCaseResponseInterceptor } from './common/interceptors/snake-case-response.interceptor';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { PrioritiesModule } from './priorities/priorities.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IntegrationSettingsModule } from './integration-settings/integration-settings.module';
import { OrganizationModule } from './organization/organization.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { SLAModule } from './sla/sla.module';
import { ReportsModule } from './reports/reports.module';
import { HolidayCalendarsModule } from './holiday-calendars/holiday-calendars.module';
import { OnHoldReasonsModule } from './on-hold-reasons/on-hold-reasons.module';
import { ScorecardsModule } from './scorecards/scorecards.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // In-memory rate limiting (no Redis in v1, per 01-ARCHITECTURE.md §2.3 / 03-RBAC-AUTH.md §4).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
    RbacModule,
    DepartmentsModule,
    UsersModule,
    WorkflowsModule,
    PrioritiesModule,
    CustomFieldsModule,
    TasksModule,
    NotificationsModule,
    IntegrationSettingsModule,
    OrganizationModule,
    DashboardsModule,
    SLAModule,
    ReportsModule,
    HolidayCalendarsModule,
    OnHoldReasonsModule,
    ScorecardsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SnakeCaseResponseInterceptor },
  ],
})
export class AppModule {}
