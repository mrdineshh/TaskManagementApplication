import { z } from 'zod';

/** Singleton org settings row per 02-DATA-MODEL.md §2.1. */
export interface OrganizationSettings {
  id: string;
  name: string;
  timezone: string; // IANA tz
  logo_url: string | null;
  sso_config: Record<string, unknown> | null;
}

export const updateOrganizationSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).optional(),
  logo_url: z.string().url().nullable().optional(),
});
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
