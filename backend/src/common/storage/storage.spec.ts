import { NoSuchKey, S3ServiceException } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AppConfigService } from '../../config/app-config.service';
import { detectImageType } from './image-type';
import {
  createObjectStore,
  S3ObjectStore,
  type ObjectStore,
} from './object-store';
import { StorageService } from './storage.service';

describe('detectImageType', () => {
  const header = (...bytes: number[]) =>
    Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

  it('recognizes PNG, JPEG and WebP by their first bytes', () => {
    expect(
      detectImageType(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toEqual({ mime: 'image/png', extension: 'png' });
    expect(detectImageType(header(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
    expect(
      detectImageType(
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WEBPVP8 '),
        ]),
      ),
    ).toEqual({ mime: 'image/webp', extension: 'webp' });
  });

  it.each([
    ['an SVG, which can carry scripts', Buffer.from('<svg xmlns="x"></svg>')],
    ['HTML', Buffer.from('<html><script>alert(1)</script>')],
    ['a GIF (not supported)', Buffer.from('GIF89a......')],
    ['a RIFF file that is not WebP', Buffer.from('RIFF....WAVEfmt ')],
    ['an empty file', Buffer.alloc(0)],
    ['a truncated PNG signature', Buffer.from([0x89, 0x50, 0x4e])],
  ])('rejects %s', (_name, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });
});

describe('StorageService', () => {
  const store = (): ObjectStore => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    prepare: vi.fn(),
  });

  describe('without configuration', () => {
    const service = new StorageService(null);

    it('is off, starts quietly and finds nothing', async () => {
      expect(service.enabled).toBe(false);
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(await service.get('any')).toBeNull();
      await expect(service.remove('any')).resolves.toBeUndefined();
    });

    it('refuses to store with 503 and a clear message', async () => {
      await expect(
        service.put('k', Buffer.alloc(1), 'image/png'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('with a store', () => {
    it('prepares the store at start and keeps starting when it is unreachable', async () => {
      const working = store();
      await new StorageService(working).onModuleInit();
      expect(working.prepare).toHaveBeenCalled();

      const broken = store();
      vi.mocked(broken.prepare).mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        new StorageService(broken).onModuleInit(),
      ).resolves.toBeUndefined();
    });

    it('passes the operations through', async () => {
      const inner = store();
      vi.mocked(inner.get).mockResolvedValue({
        body: Readable.from([]),
        contentType: 'image/png',
      });
      const service = new StorageService(inner);

      await service.put('k', Buffer.alloc(1), 'image/png');
      await service.get('k');
      await service.remove('k');

      expect(inner.put).toHaveBeenCalledWith('k', Buffer.alloc(1), 'image/png');
      expect(inner.get).toHaveBeenCalledWith('k');
      expect(inner.delete).toHaveBeenCalledWith('k');
    });

    it('never fails because a leftover could not be removed', async () => {
      const inner = store();
      vi.mocked(inner.delete).mockRejectedValue(new Error('denied'));

      await expect(
        new StorageService(inner).remove('k'),
      ).resolves.toBeUndefined();
    });
  });
});

describe('S3ObjectStore', () => {
  const send = vi.fn();
  const objectStore = new S3ObjectStore({ send } as never, 'bucket');
  const notFound = () =>
    new NoSuchKey({ message: 'missing', $metadata: { httpStatusCode: 404 } });

  beforeEach(() => {
    send.mockReset();
  });

  it('stores an object with its type', async () => {
    await objectStore.put('a/b.png', Buffer.from('x'), 'image/png');

    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'bucket',
      Key: 'a/b.png',
      Body: Buffer.from('x'),
      ContentType: 'image/png',
    });
  });

  it('reads an object with the type it was stored with', async () => {
    const body = Readable.from(['x']);
    send.mockResolvedValue({ Body: body, ContentType: 'image/webp' });

    expect(await objectStore.get('k')).toEqual({
      body,
      contentType: 'image/webp',
    });
  });

  it('answers null for a missing object, but fails on real errors', async () => {
    send.mockRejectedValueOnce(notFound());
    expect(await objectStore.get('k')).toBeNull();

    send.mockRejectedValueOnce(new Error('network down'));
    await expect(objectStore.get('k')).rejects.toThrow('network down');
  });

  it('deletes by key', async () => {
    await objectStore.delete('k');

    expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'bucket', Key: 'k' });
  });

  describe('prepare', () => {
    it('leaves an existing bucket alone', async () => {
      await objectStore.prepare();

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('creates the bucket when it does not exist', async () => {
      send.mockRejectedValueOnce(
        new S3ServiceException({
          name: 'NotFound',
          $fault: 'client',
          $metadata: { httpStatusCode: 404 },
        }),
      );

      await objectStore.prepare();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0].input).toEqual({ Bucket: 'bucket' });
    });

    it('fails when the server cannot be reached or the keys are wrong', async () => {
      send.mockRejectedValue(new Error('invalid credentials'));

      await expect(objectStore.prepare()).rejects.toThrow(
        'invalid credentials',
      );
    });
  });
});

describe('createObjectStore', () => {
  const config = (enabled: boolean) =>
    ({
      storageEnabled: enabled,
      storage: {
        endpoint: 'http://minio:9000',
        bucket: 'flowsync',
        region: 'us-east-1',
        accessKey: 'key',
        secretKey: 'secret',
        forcePathStyle: true,
      },
    }) as unknown as AppConfigService;

  it('creates nothing without a key pair', () => {
    expect(createObjectStore(config(false))).toBeNull();
  });

  it('creates the store when configured', () => {
    expect(createObjectStore(config(true))).toBeInstanceOf(S3ObjectStore);
  });
});
