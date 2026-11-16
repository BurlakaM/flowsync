import { Readable } from 'node:stream';
import type {
  ObjectStore,
  StoredObject,
} from '../../src/common/storage/object-store';

/** A file store that lives in memory, so the e2e tests need no S3 server. */
export class MemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  get(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    return Promise.resolve(
      object
        ? {
            body: Readable.from([object.body]),
            contentType: object.contentType,
          }
        : null,
    );
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }
}
