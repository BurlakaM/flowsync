import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

interface Entry {
  type: string;
  entityType: string;
  entityId: number;
  data: Record<string, unknown>;
  actor: { id: number; name: string } | null;
}

describe('Project activity (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: number;

  const feed = async (query = '', user: TestUser = owner) =>
    (
      await api
        .get(`/api/projects/${projectId}/activity${query}`, user)
        .expect(200)
    ).body as { items: Entry[]; meta: { total: number } };
  const types = async (user: TestUser = owner) =>
    (await feed('?limit=100', user)).items.map((entry) => entry.type);

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');
    projectId = (
      await api.post('/api/projects', owner, { name: 'Feed' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('needs a token', async () => {
      await api.get(`/api/projects/${projectId}/activity`).expect(401);
    });

    it('is a 404 for someone who cannot see the project', async () => {
      await api
        .get(`/api/projects/${projectId}/activity`, outsider)
        .expect(404);
    });

    it('is readable by the owner and by members', async () => {
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      await feed('', owner);
      await feed('', member);
    });

    it('validates the paging', async () => {
      await api
        .get(`/api/projects/${projectId}/activity?limit=1000`, owner)
        .expect(400);
    });
  });

  describe('what is recorded', () => {
    let taskId: number;
    let commentId: number;

    it('records the project and the member, newest first, with the actor', async () => {
      const entries = (await feed('?limit=100')).items;

      expect(entries.map((entry) => entry.type)).toEqual([
        'member.added',
        'project.created',
      ]);
      expect(entries[0]).toMatchObject({
        entityType: 'Member',
        entityId: member.id,
        data: { name: 'member' },
        actor: { id: owner.id, name: 'owner' },
      });
    });

    it('records tasks with the changes made to them', async () => {
      taskId = (
        await api
          .post(`/api/projects/${projectId}/tasks`, member, {
            name: 'First task',
            assigneeIds: [member.id],
          })
          .expect(201)
      ).body.id;
      await api
        .patch(`/api/tasks/${taskId}`, owner, { status: 'DONE' })
        .expect(200);

      const [updated, created] = (await feed('?limit=2')).items;

      expect(created).toMatchObject({
        type: 'task.created',
        entityId: taskId,
        data: { name: 'First task', assigneeIds: [member.id] },
        actor: { name: 'member' },
      });
      expect(updated).toMatchObject({
        type: 'task.updated',
        data: {
          changed: ['status'],
          status: { from: 'TODO', to: 'DONE' },
          assigneesAdded: [],
        },
        actor: { name: 'owner' },
      });
    });

    it('records comments with an excerpt and tags with their names', async () => {
      commentId = (
        await api
          .post(`/api/tasks/${taskId}/comments`, member, { text: 'Looks good' })
          .expect(201)
      ).body.id;
      const tag = (
        await api
          .post(`/api/projects/${projectId}/tags`, owner, { name: 'urgent' })
          .expect(201)
      ).body;

      const [tagEntry, commentEntry] = (await feed('?limit=2')).items;

      expect(commentEntry).toMatchObject({
        type: 'comment.created',
        entityId: commentId,
        data: { taskId, taskName: 'First task', excerpt: 'Looks good' },
      });
      expect(tagEntry).toMatchObject({
        type: 'tag.created',
        entityId: tag.id,
        data: { name: 'urgent' },
      });
    });

    it('records deletions and removals', async () => {
      await api.del(`/api/comments/${commentId}`, owner).expect(204);
      await api.del(`/api/tasks/${taskId}`, owner).expect(204);
      await api
        .del(`/api/projects/${projectId}/members/${member.id}`, owner)
        .expect(204);

      expect((await types()).slice(0, 3)).toEqual([
        'member.removed',
        'task.deleted',
        'comment.deleted',
      ]);
    });

    it('records nothing for a request that was refused', async () => {
      const before = (await feed()).meta.total;

      await api
        .post(`/api/projects/${projectId}/tasks`, outsider, { name: 'No' })
        .expect(404);
      await api
        .patch(`/api/projects/${projectId}`, member, { name: 'Hijacked' })
        .expect(404);

      expect((await feed()).meta.total).toBe(before);
    });

    it('pages the feed', async () => {
      const all = (await feed('?limit=100')).items;
      const second = (await feed('?limit=2&page=2')).items;

      expect(second.map((entry) => entry.type)).toEqual(
        all.slice(2, 4).map((entry) => entry.type),
      );
    });
  });

  describe('lifetime of the log', () => {
    it('keeps the entry, without an actor, when its author is deleted', async () => {
      const temp = await api.signUp('temp');
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: temp.email,
        })
        .expect(201);
      await api
        .post(`/api/projects/${projectId}/tags`, temp, { name: 'temp-tag' })
        .expect(201);

      await api.prisma.user.delete({ where: { id: temp.id } });

      const entry = (await feed('?limit=100')).items.find(
        (item) => item.data.name === 'temp-tag',
      );
      expect(entry?.actor).toBeNull();
    });

    it('is removed together with the project', async () => {
      const other = (
        await api
          .post('/api/projects', owner, { name: 'Temporary' })
          .expect(201)
      ).body.id;
      expect(
        await api.prisma.auditLog.count({ where: { projectId: other } }),
      ).toBe(1);

      await api.del(`/api/projects/${other}`, owner).expect(204);

      expect(
        await api.prisma.auditLog.count({ where: { projectId: other } }),
      ).toBe(0);
    });
  });
});
