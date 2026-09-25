import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

/**
 * Real GCS-backed storage service (docs/01-ARCHITECTURE.md §2.4 / P5-04).
 * Implements the two-step signed-URL upload contract from 04-API-SPEC.md §9:
 *   1. POST /tasks/:id/attachments → initUpload() → signed PUT URL (10 min)
 *   2. Client PUTs directly to GCS
 *   3. POST /tasks/:id/attachments/complete → verifyAndRecord()
 *
 * Cloud Run service account needs: roles/storage.objectAdmin on the bucket.
 * Bucket name from env GCS_ATTACHMENTS_BUCKET (set in Cloud Run env vars).
 */
@Injectable()
export class StorageService {
  private readonly storage: Storage;
  private readonly bucket: string;

  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ]);

  private static readonly MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  constructor(private readonly config: ConfigService) {
    this.storage = new Storage();
    this.bucket = this.config.get<string>('GCS_ATTACHMENTS_BUCKET') ?? 'taskapp-attachments-testing-sujeeth';
  }

  /**
   * Validates the file metadata and returns a V4 signed URL for the client
   * to PUT the file directly to GCS. The storagePath is deterministic so
   * verifyAndRecord() can look it up without a separate DB row.
   */
  async initUpload(opts: {
    storagePath: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string; storagePath: string }> {
    if (!StorageService.ALLOWED_MIME_TYPES.has(opts.contentType)) {
      throw new BadRequestException(`File type "${opts.contentType}" is not allowed`);
    }
    if (opts.sizeBytes > StorageService.MAX_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds the 10 MB size limit`);
    }

    const [uploadUrl] = await this.storage
      .bucket(this.bucket)
      .file(opts.storagePath)
      .generateSignedPostPolicyV4({
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
        conditions: [
          ['content-length-range', 1, StorageService.MAX_SIZE_BYTES],
          ['eq', '$Content-Type', opts.contentType],
        ],
        fields: { 'Content-Type': opts.contentType },
      })
      .then(([policy]) => [policy.url]);

    return { uploadUrl, storagePath: opts.storagePath };
  }

  /**
   * After the client PUTs to GCS, verify the object actually landed (size,
   * type) before recording it in the DB. Returns the signed download URL.
   */
  async verifyUpload(storagePath: string): Promise<{ exists: boolean; size?: number; contentType?: string }> {
    const file = this.storage.bucket(this.bucket).file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return { exists: false };
    const [metadata] = await file.getMetadata();
    return {
      exists: true,
      size: Number(metadata.size),
      contentType: metadata.contentType as string,
    };
  }

  /**
   * Returns a short-lived signed GET URL for secure, authorised downloads.
   * Never expose the raw GCS path to clients — always go through this.
   */
  async getDownloadUrl(storagePath: string, expiresInSeconds = 900): Promise<string> {
    const file = this.storage.bucket(this.bucket).file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new NotFoundException('Attachment not found in storage');

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
      responseDisposition: 'attachment',
    });
    return url;
  }

  /** Soft-delete: move object to a quarantine prefix rather than hard-delete. */
  async softDelete(storagePath: string): Promise<void> {
    const src = this.storage.bucket(this.bucket).file(storagePath);
    const [exists] = await src.exists();
    if (!exists) return;
    await src.copy(this.storage.bucket(this.bucket).file(`_deleted/${storagePath}`));
    await src.delete();
  }
}
