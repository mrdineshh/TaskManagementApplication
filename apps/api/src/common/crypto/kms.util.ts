import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Envelope encryption for Admin-UI-configured secrets (docs/01-ARCHITECTURE.md §2.9a) —
 * e.g. the SMTP password on IntegrationSetting.encrypted_config. In production this key
 * material comes from Cloud KMS; locally/in dev it falls back to DEV_KMS_FALLBACK_KEY so
 * the same encrypt/decrypt code path is exercised without real GCP access.
 *
 * Swap this module's key source for an actual Cloud KMS client when GCP access is available —
 * callers (MailService, integration-settings controller) don't need to change.
 */
function getKey(): Buffer {
  const material = process.env.DEV_KMS_FALLBACK_KEY ?? 'dev-only-32-byte-fallback-key!!';
  return scryptSync(material, 'taskapp-kms-salt', 32);
}

export function encryptSecret(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptSecret(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
