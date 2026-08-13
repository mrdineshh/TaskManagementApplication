import { Body, Controller, ForbiddenException, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import {
  notificationChannels,
  notificationTypes,
  updateOwnProfileSchema,
  type NotificationChannel,
  type NotificationType,
} from '@taskapp/shared-types';
import { AuthService, type AccessTokenPayload } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExchangeTokenDto, RefreshTokenDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';

class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  push_token!: string;
}

class NotificationPreferenceEntryDto {
  @IsIn(notificationTypes)
  type!: NotificationType;

  @IsIn(notificationChannels)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;
}

class UpdateNotificationPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceEntryDto)
  preferences!: NotificationPreferenceEntryDto[];
}

class SetActiveRoleDto {
  @IsUUID()
  role_id!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('google')
  google(@Body() dto: ExchangeTokenDto) {
    return this.auth.exchange('google', dto.token);
  }

  /** Dev-only mock sign-in — see providers/dev-auth.provider.ts. Disabled unless AUTH_PROVIDERS includes "dev". */
  @Public()
  @Post('dev')
  dev(@Body() dto: ExchangeTokenDto) {
    return this.auth.exchange('dev', dto.token);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Public()
  @Post('logout')
  logout() {
    // Stateless JWTs in v1 — nothing server-side to revoke; the client discards its tokens.
    // A refresh-token denylist is a reasonable v1.1 hardening addition if needed.
    return { success: true };
  }
}

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AccessTokenPayload) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: record.id,
      email: record.email,
      full_name: record.fullName,
      avatar_url: record.avatarUrl,
      primary_department_id: record.primaryDepartmentId,
      work_country: record.workCountry,
      work_state: record.workState,
      manager_id: record.managerId,
      active_role_id: record.activeRoleId,
      auth_provider: record.authProvider,
      is_active: record.isActive,
      last_login_at: record.lastLoginAt,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      roles: record.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
      permissions: user.permissions,
    };
  }

  /**
   * Role-toggle (docs/10-OPEN-DECISIONS.md §G3): switches which held role the UI is framed
   * around. Deliberately does NOT touch authorization — the JWT's permission set already
   * covers every role this user holds, unaffected by this. Rejects switching to a role the
   * user doesn't actually hold, since activeRoleId is otherwise an unchecked foreign key.
   */
  @Patch('active-role')
  async setActiveRole(@CurrentUser() user: AccessTokenPayload, @Body() dto: SetActiveRoleDto) {
    const held = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.sub, roleId: dto.role_id } },
    });
    if (!held) {
      throw new ForbiddenException('You do not hold this role');
    }
    await this.prisma.user.update({ where: { id: user.sub }, data: { activeRoleId: dto.role_id } });
    return { success: true, active_role_id: dto.role_id };
  }

  @Patch()
  async updateMe(@CurrentUser() user: AccessTokenPayload, @Body() body: unknown) {
    const input = updateOwnProfileSchema.parse(body);
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { fullName: input.full_name, avatarUrl: input.avatar_url },
    });
    return { id: updated.id, full_name: updated.fullName, avatar_url: updated.avatarUrl };
  }

  /** Mobile push registration (v1.1, docs/05-FEATURES.md §2.6) — stores an Expo push token for this user. */
  @Post('push-token')
  async registerPushToken(@CurrentUser() user: AccessTokenPayload, @Body() dto: RegisterPushTokenDto) {
    await this.prisma.user.update({ where: { id: user.sub }, data: { pushToken: dto.push_token } });
    return { success: true };
  }

  /**
   * Per-event, per-channel notification preferences (docs/05-FEATURES.md §1.5). Always returns
   * the full type x channel matrix — rows with no stored override resolve to enabled=true, since
   * NotificationsService.notify() treats "no row" as enabled too.
   */
  @Get('notification-preferences')
  async getNotificationPreferences(@CurrentUser() user: AccessTokenPayload) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId: user.sub } });
    const overrides = new Map(rows.map((r) => [`${r.type}:${r.channel}`, r.enabled]));
    return notificationTypes.flatMap((type) =>
      notificationChannels.map((channel) => ({
        type,
        channel,
        enabled: overrides.get(`${type}:${channel}`) ?? true,
      })),
    );
  }

  @Put('notification-preferences')
  async updateNotificationPreferences(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateNotificationPreferencesDto) {
    for (const p of dto.preferences) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_type_channel: { userId: user.sub, type: p.type, channel: p.channel } },
        update: { enabled: p.enabled },
        create: { userId: user.sub, type: p.type, channel: p.channel, enabled: p.enabled },
      });
    }
    return { success: true };
  }
}
