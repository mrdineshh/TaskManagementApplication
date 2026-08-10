import { z } from 'zod';

/**
 * Admin-configurable operational settings (01-ARCHITECTURE.md §2.9a) — stored in the DB,
 * NOT deployment secrets. `encrypted_config` never leaves the server decrypted.
 */
export interface IntegrationSetting {
  id: string;
  key: string; // e.g. "smtp", "slack_webhook"
  config: Record<string, unknown>; // non-sensitive fields only
  updated_by_id: string;
  updated_at: string;
}

export const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  from_address: z.string().email(),
  use_tls: z.boolean().default(true),
  username: z.string().min(1),
  /** Sensitive — only accepted on write, stored via Cloud KMS envelope encryption, never echoed back. */
  password: z.string().min(1).optional(),
});
export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

/** Non-sensitive shape returned by GET — password/secret fields are always omitted. */
export type SmtpConfigPublic = Omit<SmtpConfig, 'password'>;
