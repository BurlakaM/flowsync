import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OBJECT_STORE,
  type ObjectStore,
  type StoredObject,
} from './object-store';

/**
 * Files for the rest of the application. Without a configured store it does not break anything: reading
 * finds nothing, and writing answers 503 with a clear message.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(OBJECT_STORE) private readonly store: ObjectStore | null,
  ) {}

  get enabled(): boolean {
    return this.store !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.store) {
      this.logger.log(
        'File storage is off (S3_ACCESS_KEY and S3_SECRET_KEY are not set): uploading is unavailable.',
      );
      return;
    }
    try {
      await this.store.prepare();
      this.logger.log('File storage is on.');
    } catch (error) {
      // The server is down or the keys are wrong: the application must still start. Uploads will fail
      // with their own error until it is fixed.
      this.logger.error(
        `File storage is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.requireStore().put(key, body, contentType);
  }

  async get(key: string): Promise<StoredObject | null> {
    return this.store ? this.store.get(key) : null;
  }

  /** Best effort: an object that cannot be removed is only a leftover, never a reason to fail a request. */
  async remove(key: string): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.delete(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private requireStore(): ObjectStore {
    if (!this.store) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server.',
      );
    }
    return this.store;
  }
}
