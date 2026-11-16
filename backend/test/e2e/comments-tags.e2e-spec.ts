import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

describe('Comments and tags (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: number;
  let taskId: number;

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');

    projectId = (
      await api.post('/api/projects', owner, { name: 'Talk' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);
    taskId = (
      await api
        .post(`/api/projects/${projectId}/tasks`, owner, { name: 'Discuss' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('comments', () => {
    const comment = async (user: TestUser, text: string) =>
      (
        await api
          .post(`/api/tasks/${taskId}/comments`, user, { text })
          .expect(201)
      ).body;

    it('lets a member comment and shows the author', async () => {
      const created = await comment(member, '  Looks good  ');

      expect(created).toMatchObject({
        text: 'Looks good',
        taskId,
        author: { id: member.id, name: 'member' },
      });
    });

    it('counts the comments on the task', async () => {
      await comment(owner, 'One more');

      const task = await api.get(`/api/tasks/${taskId}`, owner).expect(200);

      expect(task.body.commentsCount).toBeGreaterThanOrEqual(2);
    });

    it('rejects an empty comment and server-controlled fields', async () => {
      await api
        .post(`/api/tasks/${taskId}/comments`, owner, { text: '  ' })
        .expect(400);
      await api
        .post(`/api/tasks/${taskId}/comments`, owner, { text: 'x', taskId: 5 })
        .expect(400);
    });

    it('lists oldest first with pagination', async () => {
      const thread = (
        await api.post('/api/projects', owner, { name: 'Thread' }).expect(201)
      ).body.id;
      const task = (
        await api
          .post(`/api/projects/${thread}/tasks`, owner, { name: 'T' })
          .expect(201)
      ).body.id;
      for (const text of ['first', 'second', 'third']) {
        await api
          .post(`/api/tasks/${task}/comments`, owner, { text })
          .expect(201);
      }

      const page = await api
        .get(`/api/tasks/${task}/comments?limit=2&page=2`, owner)
        .expect(200);
      expect(page.body.items.map((c: { text: string }) => c.text)).toEqual([
        'third',
      ]);
      expect(page.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });

      const all = await api
        .get(`/api/tasks/${task}/comments`, owner)
        .expect(200);
      expect(all.body.items.map((c: { text: string }) => c.text)).toEqual([
        'first',
        'second',
        'third',
      ]);
    });

    it('hides the thread from outsiders', async () => {
      await api.get(`/api/tasks/${taskId}/comments`, outsider).expect(404);
      await api
        .post(`/api/tasks/${taskId}/comments`, outsider, { text: 'hi' })
        .expect(404);
    });

    it('lets only the author edit a comment', async () => {
      const created = await comment(member, 'draft');

      const edited = await api
        .patch(`/api/comments/${created.id}`, member, { text: 'final' })
        .expect(200);
      expect(edited.body.text).toBe('final');

      await api
        .patch(`/api/comments/${created.id}`, owner, { text: 'hijack' })
        .expect(403);
      await api
        .patch(`/api/comments/${created.id}`, outsider, { text: 'x' })
        .expect(404);
    });

    it('lets the author and the project owner delete, but not another member', async () => {
      const second = await api.signUp('second-member');
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: second.email,
        })
        .expect(201);

      const own = await comment(member, 'mine');
      await api.del(`/api/comments/${own.id}`, member).expect(204);

      const moderated = await comment(member, 'moderate me');
      await api.del(`/api/comments/${moderated.id}`, owner).expect(204);

      const protectedOne = await comment(member, 'keep');
      await api.del(`/api/comments/${protectedOne.id}`, second).expect(403);
      await api.del(`/api/comments/${protectedOne.id}`, outsider).expect(404);
    });

    it('keeps the comment when its author account is deleted', async () => {
      const temp = await api.signUp('temp-author');
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: temp.email,
        })
        .expect(201);
      const created = await comment(temp, 'last words');

      await api.prisma.user.delete({ where: { id: temp.id } });

      const list = await api
        .get(`/api/tasks/${taskId}/comments?limit=100`, owner)
        .expect(200);
      const kept = list.body.items.find(
        (c: { id: number }) => c.id === created.id,
      );
      expect(kept).toMatchObject({ text: 'last words', author: null });
    });
  });

  describe('tags', () => {
    const tags = (user = owner) =>
      api.get(`/api/projects/${projectId}/tags`, user);

    it('lets any member create tags and lists them alphabetically', async () => {
      await api
        .post(`/api/projects/${projectId}/tags`, member, { name: 'zebra' })
        .expect(201);
      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: '  alpha ' })
        .expect(201);

      const res = await tags().expect(200);

      expect(res.body.map((tag: { name: string }) => tag.name)).toEqual([
        'alpha',
        'zebra',
      ]);
      expect(res.body[0]).toMatchObject({ projectId });
    });

    it('rejects duplicates inside a project but allows the same name elsewhere', async () => {
      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: 'alpha' })
        .expect(409);

      const other = (
        await api.post('/api/projects', owner, { name: 'Other' }).expect(201)
      ).body.id;
      await api
        .post(`/api/projects/${other}/tags`, owner, { name: 'alpha' })
        .expect(201);
    });

    it('validates the name', async () => {
      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: ' ' })
        .expect(400);
      await api
        .post(`/api/projects/${projectId}/tags`, owner, {
          name: 'x'.repeat(51),
        })
        .expect(400);
    });

    it('hides the tags from outsiders', async () => {
      await tags(outsider).expect(404);
      await api
        .post(`/api/projects/${projectId}/tags`, outsider, { name: 'x' })
        .expect(404);
    });

    it('renames a tag, but not to a name that is taken', async () => {
      const tag = (
        await api
          .post(`/api/projects/${projectId}/tags`, owner, { name: 'rename-me' })
          .expect(201)
      ).body;

      const renamed = await api
        .patch(`/api/tags/${tag.id}`, member, { name: 'renamed' })
        .expect(200);
      expect(renamed.body.name).toBe('renamed');

      await api
        .patch(`/api/tags/${tag.id}`, owner, { name: 'zebra' })
        .expect(409);
      await api
        .patch(`/api/tags/${tag.id}`, owner, { name: 'renamed' })
        .expect(200);
      await api
        .patch(`/api/tags/${tag.id}`, outsider, { name: 'x' })
        .expect(404);
    });

    it('lets only the owner delete a tag and removes it from the tasks', async () => {
      const tag = (
        await api
          .post(`/api/projects/${projectId}/tags`, owner, { name: 'temporary' })
          .expect(201)
      ).body;
      const task = (
        await api
          .post(`/api/projects/${projectId}/tasks`, owner, {
            name: 'Tagged',
            tagIds: [tag.id],
          })
          .expect(201)
      ).body;
      expect(task.tags).toHaveLength(1);

      await api.del(`/api/tags/${tag.id}`, member).expect(403);
      await api.del(`/api/tags/${tag.id}`, outsider).expect(404);
      await api.del(`/api/tags/${tag.id}`, owner).expect(204);

      const after = await api.get(`/api/tasks/${task.id}`, owner).expect(200);
      expect(after.body.tags).toEqual([]);
    });
  });
});
