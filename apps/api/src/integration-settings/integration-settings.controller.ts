import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { encryptSecret } from '../common/crypto/kms.util';
import { MailService } from '../notifications/mail/mail.service';

class UpsertIntegrationSettingDto {
  // NOTE: every property needs a class-validator decorator — the global
  // ValidationPipe runs with whitelist:true, which silently strips any
  // undecorated property before it reaches the controller.
  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;
}

/**
 * Admin-configurable operational settings (SMTP, future integrations) — DB-stored and
 * KMS-encrypted, editable at runtime with no redeploy, per docs/01-ARCHITECTURE.md §2.9a.
 */
@ApiTags('integration-settings')
@Controller('integration-settings')
export class IntegrationSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Get(':key')
  @RequirePermission('integration_settings.manage')
  async get(@Param('key') key: string) {
    const setting = await this.prisma.integrationSetting.findUnique({ where: { key } });
    if (!setting) return { key, config: {}, has_secret: false };
    // encrypted_config is never returned decrypted to the client, per 02-DATA-MODEL.md §2.1a.
    return { key: setting.key, config: setting.config, has_secret: !!setting.encryptedConfig, updated_at: setting.updatedAt };
  }

  @Put(':key')
  @RequirePermission('integration_settings.manage')
  async upsert(
    @CurrentUser() user: AccessTokenPayload,
    @Param('key') key: string,
    @Body() dto: UpsertIntegrationSettingDto,
  ) {
    const setting = await this.prisma.integrationSetting.upsert({
      where: { key },
      update: {
        config: dto.config as Prisma.InputJsonValue,
        ...(dto.secret ? { encryptedConfig: encryptSecret(dto.secret) } : {}),
        updatedById: user.sub,
      },
      create: {
        key,
        config: dto.config as Prisma.InputJsonValue,
        encryptedConfig: dto.secret ? encryptSecret(dto.secret) : null,
        updatedById: user.sub,
      },
    });
    return { key: setting.key, config: setting.config, has_secret: !!setting.encryptedConfig };
  }

  @Post(':key/test')
  @RequirePermission('integration_settings.manage')
  async test(@Param('key') key: string) {
    if (key === 'smtp') {
      await this.mail.send('test@example.com', 'Task Management test email', 'This is a test.');
      return { success: true, message: 'Test email dispatched (see server logs if SMTP send is mocked).' };
    }
    return { success: false, message: `No test handler for integration "${key}"` };
  }
}
