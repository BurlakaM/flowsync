import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';
import { MemoryObjectStore } from '../utils/memory-store';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('not really a picture, but it has the signature'),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('jpeg body'),
]);

describe('Project picture (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let store: MemoryObjectStore;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: number;

  const upload = (
    file: Buffer,
    options: { filename?: string; contentType?: string; field?: string } = {},
    user: TestUser | null = owner,
    id = projectId,
  ) => {
    const req = request(app.getHttpServer()).put(`/api/projects/${id}/image`);
    if (user) req.set(api.auth(user));
    return req.attach(options.field ?? 'file', file, {
      filename: options.filename ?? 'picture.png',
      contentType: options.contentType ?? 'image/png',
    });
  };

  beforeAll(async () => {
    store = new MemoryObjectStore();
    app = await createTestApp({ objectStore: store });
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');
    projectId = (
      await api.post('/api/projects', owner, { name: 'Pictures' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('before there is a picture', () => {
    it('reports none and answers 404 for the bytes', async () => {
      const project = (await api.get(`/api/projects/${projectId}`, owner)).body;

      expect(project.hasImage).toBe(false);
      expect(project).not.toHaveProperty('image');
      await api.get(`/api/projects/${projectId}/image`, owner).expect(404);
    });

    it('removing a missing picture is not an error', async () => {
      await api.del(`/api/projects/${projectId}/image`, owner).expect(204);
    });
  });

  describe('uploading', () => {
    it('needs a token', async () => {
      await upload(PNG, {}, null).expect(401);
    });

    it('is for the owner only', async () => {
      await upload(PNG, {}, member).expect(403);
      await upload(PNG, {}, outsider).expect(404);
      expect(store.objects.size).toBe(0);
    });

    it('stores the picture and reports it', async () => {
      const res = await upload(PNG).expect(200);

      expect(res.body).toMatchObject({ id: projectId, hasImage: true });
      expect(res.body).not.toHaveProperty('image');
      expect([...store.objects.keys()]).toEqual([
        expect.stringMatching(
          new RegExp(`^projects/${projectId}/[0-9a-f-]{36}\\.png$`),
        ),
      ]);
    });

    it('replaces the picture and deletes the previous object', async () => {
      await upload(JPEG, {
        filename: 'new.jpg',
        contentType: 'image/jpeg',
      }).expect(200);

      const keys = [...store.objects.keys()];
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatch(/\.jpg$/);
    });

    it('lists the picture in the project and in the list of projects', async () => {
      expect(
        (await api.get(`/api/projects/${projectId}`, member)).body.hasImage,
      ).toBe(true);
      const list = (await api.get('/api/projects', owner)).body.items;
      expect(
        list.find((item: { id: number }) => item.id === projectId).hasImage,
      ).toBe(true);
    });
  });

  describe('what is accepted', () => {
    it('judges by the bytes, not by the name or the type the client claims', async () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>');

      await upload(html, {
        filename: 'cat.png',
        contentType: 'image/png',
      }).expect(400);
      await upload(Buffer.from('<svg onload="alert(1)"/>'), {
        filename: 'logo.svg',
        contentType: 'image/svg+xml',
      }).expect(400);
      await upload(Buffer.from('GIF89a......'), {
        filename: 'a.gif',
        contentType: 'image/gif',
      }).expect(400);
    });

    it('accepts a real picture even with a wrong name', async () => {
      await upload(PNG, {
        filename: 'photo.txt',
        contentType: 'text/plain',
      }).expect(200);
    });

    it('refuses a file over 2 MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);

      await upload(big).expect(413);
    });

    it('refuses a request without the picture or with another field name', async () => {
      await request(app.getHttpServer())
        .put(`/api/projects/${projectId}/image`)
        .set(api.auth(owner))
        .expect(400);
      await upload(PNG, { field: 'picture' }).expect(400);
    });

    it('does not let a client choose where the picture lives', async () => {
      await api
        .patch(`/api/projects/${projectId}`, owner, {
          image: 'projects/1/x.png',
        })
        .expect(400);
      await api
        .post('/api/projects', owner, { name: 'Sneaky', image: 'other/key' })
        .expect(400);
    });
  });

  describe('viewing', () => {
    it('serves the bytes with the stored type to members', async () => {
      for (const user of [owner, member]) {
        const res = await api
          .get(`/api/projects/${projectId}/image`, user)
          .expect(200)
          .buffer(true)
          .parse((response, callback) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => callback(null, Buffer.concat(chunks)));
          });

        expect(res.headers['content-type']).toBe('image/png');
        expect(res.headers['cache-control']).toBe('private, max-age=300');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
      }
    });

    it('needs a token and hides the picture from outsiders', async () => {
      await api.get(`/api/projects/${projectId}/image`).expect(401);
      await api.get(`/api/projects/${projectId}/image`, outsider).expect(404);
    });

    it('is a 404 when the object has disappeared from the storage', async () => {
      const saved = new Map(store.objects);
      store.objects.clear();

      await api.get(`/api/projects/${projectId}/image`, owner).expect(404);

      saved.forEach((value, key) => store.objects.set(key, value));
    });
  });

  describe('removing', () => {
    it('is for the owner only', async () => {
      await api.del(`/api/projects/${projectId}/image`, member).expect(403);
      await api.del(`/api/projects/${projectId}/image`, outsider).expect(404);
    });

    it('deletes the object and the flag', async () => {
      await api.del(`/api/projects/${projectId}/image`, owner).expect(204);

      expect(store.objects.size).toBe(0);
      expect(
        (await api.get(`/api/projects/${projectId}`, owner)).body.hasImage,
      ).toBe(false);
      await api.get(`/api/projects/${projectId}/image`, owner).expect(404);
    });
  });

  describe('lifetime', () => {
    it('deletes the picture together with the project', async () => {
      const other = (
        await api
          .post('/api/projects', owner, { name: 'Short lived' })
          .expect(201)
      ).body.id;
      await upload(PNG, {}, owner, other).expect(200);
      expect(store.objects.size).toBe(1);

      await api.del(`/api/projects/${other}`, owner).expect(204);

      expect(store.objects.size).toBe(0);
    });

    it('is recorded in the activity of the project', async () => {
      await upload(PNG).expect(200);
      await api.del(`/api/projects/${projectId}/image`, owner).expect(204);

      const feed = (
        await api.get(`/api/projects/${projectId}/activity?limit=2`, owner)
      ).body.items;

      expect(
        feed.map((entry: { data: { image: string } }) => entry.data.image),
      ).toEqual(['removed', 'changed']);
    });
  });
});

describe('Project picture without file storage (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    // The test environment has no S3 settings: the application as it is before storage is connected.
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps everything else working and answers 503 to an upload', async () => {
    const owner = await api.signUp('owner');
    const projectId = (
      await api.post('/api/projects', owner, { name: 'No storage' }).expect(201)
    ).body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/image`)
      .set(api.auth(owner))
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(503);

    expect(res.body.message).toMatch(/not configured/i);
    await api.get(`/api/projects/${projectId}/image`, owner).expect(404);
    await api.get(`/api/projects/${projectId}`, owner).expect(200);
    await api.del(`/api/projects/${projectId}/image`, owner).expect(204);
  });
});
