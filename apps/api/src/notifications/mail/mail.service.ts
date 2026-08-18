import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret } from '../../common/crypto/kms.util';

interface SmtpConfig {
  host: string;
  port: number;
  from_address: string;
  use_tls: boolean;
  username: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/**
 * Sends transactional email via the Admin-UI-configured SMTP settings
 * (docs/01-ARCHITECTURE.md §2.9, §2.9a) — never a deployment secret.
 *
 * Until an Admin saves real SMTP credentials via /integration-settings/smtp
 * (and until real GCP/Google Workspace SMTP access is provided), this logs
 * the "sent" email instead of making a network call, so the notification
 * flow can be exercised end-to-end against mocked data.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(to: string, subject: string, body: string, attachments: MailAttachment[] = []): Promise<void> {
    const attachmentNote = attachments.length > 0 ? ` attachments=[${attachments.map((a) => a.filename).join(', ')}]` : '';
    const setting = await this.prisma.integrationSetting.findUnique({ where: { key: 'smtp' } });
    if (!setting) {
      this.logger.warn(`[mock email — no SMTP configured] to=${to} subject="${subject}"${attachmentNote}\n${body}`);
      return;
    }

    const config = setting.config as unknown as SmtpConfig;
    const password = setting.encryptedConfig ? decryptSecret(setting.encryptedConfig) : null;

    if (!config?.host || !password) {
      this.logger.warn(`[mock email — incomplete SMTP config] to=${to} subject="${subject}"${attachmentNote}`);
      return;
    }

    // A fresh transporter per send, not a cached/pooled one — SMTP settings are editable at
    // runtime via the Admin UI with no redeploy, and this app's email volume is low enough that
    // connection reuse isn't worth the staleness risk (an Admin changing credentials mid-run
    // shouldn't have the old ones linger in a pool).
    const transporter: Transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.use_tls,
      auth: { user: config.username, pass: password },
    });

    try {
      await transporter.sendMail({
        from: config.from_address,
        to,
        subject,
        text: body,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      this.logger.log(`Email sent to=${to} via ${config.host}:${config.port} subject="${subject}"${attachmentNote}`);
    } catch (err) {
      // Non-fatal by design, matching PushService — a bad SMTP send shouldn't fail the caller's
      // own operation (task assignment, report scheduling, etc.), just the notification.
      this.logger.warn(`SMTP send failed to=${to} via ${config.host}:${config.port}: ${(err as Error).message}`);
    }
  }
}
