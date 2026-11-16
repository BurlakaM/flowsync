import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AppConfigService } from '../../config/app-config.service';

export interface StoredObject {
  body: Readable;
  contentType: string;
}

/** What the application needs from a file store: three operations, whatever stores the bytes. */
export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Null when there is no such object. */
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Makes sure the bucket exists; called once at start. */
  prepare(): Promise<void>;
}

/** Injection token of the store; null while storage is not configured. Tests replace it. */
export const OBJECT_STORE = 'OBJECT_STORE';

const isMissing = (error: unknown) =>
  error instanceof S3ServiceException &&
  (error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404);

/** The store on an S3-compatible service. */
export class S3ObjectStore implements ObjectStore {
  private readonly logger = new Logger(S3ObjectStore.name);

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        body: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async prepare(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isMissing(error)) throw error;
      this.logger.log(`Creating the bucket "${this.bucket}".`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
}

/** The configured store, or none when no key pair is set. */
export function createObjectStore(
  config: AppConfigService,
): ObjectStore | null {
  if (!config.storageEnabled) return null;
  const { endpoint, bucket, region, accessKey, secretKey, forcePathStyle } =
    config.storage;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
  });
  return new S3ObjectStore(client, bucket);
}
