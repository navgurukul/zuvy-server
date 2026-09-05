import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

// Below this size, upload in a single PutObjectCommand call (simpler, and
// S3's whole-object SHA-256 checksum can be compared directly against the
// locally computed hash). At/above it, use multipart — required by S3 above
// 5GB, and safer/resumable for large recordings well before that hard limit.
const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100MB
const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export type UploadedPart = { PartNumber: number; ETag: string };

@Injectable()
export class RecordingS3Service {
  private readonly logger = new Logger(RecordingS3Service.name);
  private readonly s3: S3Client;
  private readonly region: string;
  private readonly bucket: string;

  constructor() {
    this.region = process.env.S3_REGION || 'ap-south-1';
    this.bucket =
      process.env.S3_RECORDINGS_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY_ACCESS,
      },
    });
  }

  getBucket(): string {
    return this.bucket;
  }

  isMultipartRequired(fileSizeBytes: number): boolean {
    return fileSizeBytes >= MULTIPART_THRESHOLD_BYTES;
  }

  async computeSha256(
    filePath: string,
  ): Promise<{ hex: string; base64: string }> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        const digest = hash.digest();
        resolve({
          hex: digest.toString('hex'),
          base64: digest.toString('base64'),
        });
      });
    });
  }

  async uploadSinglePart(
    key: string,
    filePath: string,
    checksumBase64: string,
  ): Promise<{ etag: string; checksumSha256: string }> {
    const body = fs.createReadStream(filePath);
    const res = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
        ChecksumAlgorithm: 'SHA256',
        ChecksumSHA256: checksumBase64,
        StorageClass: 'GLACIER',
      }),
    );

    if (res.ChecksumSHA256 && res.ChecksumSHA256 !== checksumBase64) {
      throw new Error(
        `S3 checksum mismatch for ${key}: local=${checksumBase64} s3=${res.ChecksumSHA256}`,
      );
    }

    return {
      etag: res.ETag,
      checksumSha256: res.ChecksumSHA256 || checksumBase64,
    };
  }

  // Resumable manual multipart upload. If `existingUploadId` is passed, asks
  // S3 (not the DB) which parts are already durably stored via ListParts and
  // skips re-sending them, so a retry resumes instead of restarting.
  async uploadMultipart(
    key: string,
    filePath: string,
    fileSizeBytes: number,
    existingUploadId?: string | null,
    onProgress?: (uploadId: string, parts: UploadedPart[]) => Promise<void>,
  ): Promise<{ etag: string; uploadId: string }> {
    let uploadId = existingUploadId;
    const completedParts = new Map<number, UploadedPart>();

    if (uploadId) {
      try {
        const listed = await this.s3.send(
          new ListPartsCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
          }),
        );
        for (const p of listed.Parts || []) {
          if (p.PartNumber != null && p.ETag) {
            completedParts.set(p.PartNumber, {
              PartNumber: p.PartNumber,
              ETag: p.ETag,
            });
          }
        }
        this.logger.log(
          `Resuming multipart upload ${uploadId} for ${key}, ${completedParts.size} part(s) already uploaded`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Could not resume multipart upload ${uploadId} for ${key} (${err?.message ?? err}); starting a new one`,
        );
        uploadId = null;
      }
    }

    if (!uploadId) {
      const created = await this.s3.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: 'video/mp4',
          ChecksumAlgorithm: 'SHA256',
          StorageClass: 'GLACIER',
        }),
      );
      uploadId = created.UploadId;
      completedParts.clear();
    }

    const totalParts = Math.ceil(fileSizeBytes / MULTIPART_PART_SIZE_BYTES);

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (completedParts.has(partNumber)) continue;

      const start = (partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
      const end =
        Math.min(start + MULTIPART_PART_SIZE_BYTES, fileSizeBytes) - 1;
      const partStream = fs.createReadStream(filePath, { start, end });
      const partBuffer = await streamToBuffer(partStream);
      const partChecksum = crypto
        .createHash('sha256')
        .update(partBuffer)
        .digest('base64');

      const uploaded = await this.s3.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: partBuffer,
          ChecksumSHA256: partChecksum,
        }),
      );

      completedParts.set(partNumber, {
        PartNumber: partNumber,
        ETag: uploaded.ETag,
      });

      if (onProgress) {
        await onProgress(uploadId, Array.from(completedParts.values()));
      }
    }

    const orderedParts = Array.from(completedParts.values()).sort(
      (a, b) => a.PartNumber - b.PartNumber,
    );

    const completed = await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: orderedParts },
      }),
    );

    // S3's composite multipart checksum isn't a plain whole-file SHA-256, so
    // it can't be compared directly against the locally computed hash. Per-
    // part checksums above already make S3 reject a corrupted part inline;
    // this size check is a final sanity check on top of that.
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (head.ContentLength !== fileSizeBytes) {
      throw new Error(
        `S3 object size mismatch for ${key} after multipart upload: expected ${fileSizeBytes}, got ${head.ContentLength}`,
      );
    }

    return { etag: completed.ETag, uploadId };
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.s3.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
      this.logger.log(`Aborted multipart upload ${uploadId} for ${key}`);
    } catch (err: any) {
      this.logger.warn(
        `Failed to abort multipart upload ${uploadId} for ${key}: ${err?.message ?? err}`,
      );
    }
  }

  async headObject(key: string): Promise<{ exists: boolean; size?: number }> {
    try {
      const res = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { exists: true, size: res.ContentLength };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return { exists: false };
      }
      throw err;
    }
  }

  // Initiates a Glacier restore — creates a temporary, readable copy for
  // `days` days. Does not change the object's underlying storage class; the
  // object itself stays in Glacier once the temporary copy expires.
  async initiateRestore(
    key: string,
    tier: 'Bulk' | 'Standard' | 'Expedited',
    days: number,
  ): Promise<void> {
    await this.s3.send(
      new RestoreObjectCommand({
        Bucket: this.bucket,
        Key: key,
        RestoreRequest: {
          Days: days,
          GlacierJobParameters: { Tier: tier },
        },
      }),
    );
  }

  // Parses HeadObject's `Restore` header:
  //   ongoing-request="true"                                 -> still restoring
  //   ongoing-request="false", expiry-date="..."              -> available
  //   header absent                                           -> never requested / already expired
  async getRestoreStatus(
    key: string,
  ): Promise<{ ongoing: boolean; available: boolean }> {
    const res = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const restoreHeader = res.Restore;
    if (!restoreHeader) {
      return { ongoing: false, available: false };
    }
    const ongoing = /ongoing-request="true"/.test(restoreHeader);
    return { ongoing, available: !ongoing };
  }

  // Only valid once getRestoreStatus() reports available: true.
  async downloadObject(key: string, destPath: string): Promise<void> {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = res.Body as NodeJS.ReadableStream;
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(destPath);
      body.pipe(writer);
      body.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', resolve);
    });
  }
}

function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk as Buffer));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
