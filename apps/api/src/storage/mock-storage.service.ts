import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Stand-in for Cloud Storage (docs/01-ARCHITECTURE.md §2.4) while real GCS bucket
 * access isn't available yet. Mirrors the two-step signed-URL upload contract from
 * 04-API-SPEC.md §9 — swap this service for a real @google-cloud/storage-backed one
 * once GCP credentials are provided; callers (AttachmentsController) don't change.
 */
@Injectable()
export class MockStorageService {
  private readonly root = join(process.cwd(), '.mock-storage');

  constructor() {
    mkdirSync(this.root, { recursive: true });
  }

  /** Stands in for a GCS V4 signed PUT URL — a local path the client PUTs bytes to. */
  buildUploadUrl(storagePath: string): string {
    return `/api/v1/mock-storage/${encodeURIComponent(storagePath)}`;
  }

  write(storagePath: string, contentBase64: string): void {
    const filePath = join(this.root, storagePath.replace(/[/\\]/g, '_'));
    writeFileSync(filePath, Buffer.from(contentBase64, 'base64'));
  }

  read(storagePath: string): Buffer {
    const filePath = join(this.root, storagePath.replace(/[/\\]/g, '_'));
    if (!existsSync(filePath)) throw new NotFoundException('Stored file not found');
    return readFileSync(filePath);
  }
}
