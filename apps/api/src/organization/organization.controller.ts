import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { updateOrganizationSettingsSchema } from '@taskapp/shared-types';

/**
 * Singleton org settings (docs/02-DATA-MODEL.md §2.1). Not enumerated as its own
 * section in 04-API-SPEC.md, but required by the /admin/settings screen in
 * 06-FRONTEND-WEB.md §3 — reusing `integration_settings.manage` would conflate two
 * different concerns, so this uses a dedicated `organization.manage` permission key
 * (an assumption, logged here per docs/10-OPEN-DECISIONS.md's guidance to proceed
 * on reasonable defaults rather than block).
 */
@ApiTags('organization')
@Controller('organization-settings')
export class OrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('organization.manage')
  async get() {
    const settings = await this.prisma.organizationSettings.findFirst();
    return settings ?? null;
  }

  @Patch()
  @RequirePermission('organization.manage')
  async update(@Body() body: unknown) {
    const input = updateOrganizationSettingsSchema.parse(body);
    const existing = await this.prisma.organizationSettings.findFirst();
    if (!existing) {
      return this.prisma.organizationSettings.create({
        data: { name: input.name ?? 'Organization', timezone: input.timezone ?? 'UTC', logoUrl: input.logo_url },
      });
    }
    return this.prisma.organizationSettings.update({
      where: { id: existing.id },
      data: { name: input.name, timezone: input.timezone, logoUrl: input.logo_url },
    });
  }
}
