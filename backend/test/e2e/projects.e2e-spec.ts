import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;

  const createProject = async (user: TestUser, name: string) =>
    (await api.post('/api/projects', user, { name }).expect(201)).body;

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create and read', () => {
    it('creates a project owned by the caller', async () => {
      const res = await api
        .post('/api/projects', owner, {
          name: '  Alpha  ',
          description: 'First',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Alpha',
        description: 'First',
        ownerId: owner.id,
        myRole: 'OWNER',
        tasksCount: 0,
      });
    });

    it.each([
      ['an empty name', { name: ' ' }],
      ['a too long name', { name: 'x'.repeat(101) }],
      ['an unknown field', { name: 'P', color: 'red' }],
    ])('rejects %s', async (_label, body) => {
      await api.post('/api/projects', owner, body).expect(400);
    });

    it('lists only the projects the user owns or belongs to', async () => {
      const mine = await createProject(owner, 'Mine');
      await api
        .post(`/api/projects/${mine.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);
      await createProject(outsider, 'Not yours');

      const ownerList = await api
        .get('/api/projects?limit=100', owner)
        .expect(200);
      const memberList = await api
        .get('/api/projects?limit=100', member)
        .expect(200);

      const names = (res: { body: { items: { name: string }[] } }) =>
        res.body.items.map((project) => project.name);
      expect(names(ownerList)).toContain('Mine');
      expect(names(ownerList)).not.toContain('Not yours');
      expect(names(memberList)).toEqual(['Mine']);
      expect(memberList.body.items[0].myRole).toBe('MEMBER');
    });

    it('paginates and searches', async () => {
      const user = await api.signUp('pager');
      for (const name of ['Apple', 'Apricot', 'Banana']) {
        await createProject(user, name);
      }

      const page = await api
        .get('/api/projects?limit=2&page=2', user)
        .expect(200);
      expect(page.body.items).toHaveLength(1);
      expect(page.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });

      const found = await api.get('/api/projects?search=AP', user).expect(200);
      expect(
        found.body.items.map((p: { name: string }) => p.name).sort(),
      ).toEqual(['Apple', 'Apricot']);
    });

    it('shows the details with the owner and the members', async () => {
      const project = await createProject(owner, 'Details');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      const res = await api
        .get(`/api/projects/${project.id}`, member)
        .expect(200);

      expect(res.body.owner).toEqual({ id: owner.id, name: 'owner' });
      expect(
        res.body.members.map((m: { userId: number; role: string }) => [
          m.userId,
          m.role,
        ]),
      ).toEqual([
        [owner.id, 'OWNER'],
        [member.id, 'MEMBER'],
      ]);
    });

    it('hides a project from people who are not part of it', async () => {
      const project = await createProject(owner, 'Hidden');

      await api.get(`/api/projects/${project.id}`, outsider).expect(404);
      await api
        .get(`/api/projects/${project.id}/members`, outsider)
        .expect(404);
      await api.get('/api/projects/abc', owner).expect(400);
    });
  });

  describe('update and delete', () => {
    it('lets only the owner change the project', async () => {
      const project = await createProject(owner, 'Editable');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      const ok = await api
        .patch(`/api/projects/${project.id}`, owner, { name: 'Renamed' })
        .expect(200);
      expect(ok.body.name).toBe('Renamed');

      await api
        .patch(`/api/projects/${project.id}`, member, { name: 'X' })
        .expect(403);
      await api
        .patch(`/api/projects/${project.id}`, outsider, { name: 'X' })
        .expect(404);
    });

    it('lets only the owner delete the project, with its tasks', async () => {
      const project = await createProject(owner, 'Doomed');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);
      const task = await api
        .post(`/api/projects/${project.id}/tasks`, owner, { name: 'T' })
        .expect(201);

      await api.del(`/api/projects/${project.id}`, member).expect(403);
      await api.del(`/api/projects/${project.id}`, outsider).expect(404);
      await api.del(`/api/projects/${project.id}`, owner).expect(204);

      await api.get(`/api/projects/${project.id}`, owner).expect(404);
      expect(await api.prisma.task.count({ where: { id: task.body.id } })).toBe(
        0,
      );
    });
  });

  describe('members', () => {
    it('lets the owner add and remove members by email', async () => {
      const project = await createProject(owner, 'Team');

      const added = await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: 'MEMBER@example.test',
        })
        .expect(201);
      expect(added.body).toMatchObject({ userId: member.id, role: 'MEMBER' });

      await api
        .del(`/api/projects/${project.id}/members/${member.id}`, owner)
        .expect(204);
      await api.get(`/api/projects/${project.id}`, member).expect(404);
    });

    it('rejects duplicates, the owner and unknown emails', async () => {
      const project = await createProject(owner, 'Strict');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(409);
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: owner.email,
        })
        .expect(409);
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: 'nobody@example.test',
        })
        .expect(404);
    });

    it('does not let members manage the team', async () => {
      const project = await createProject(owner, 'Locked');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      await api
        .post(`/api/projects/${project.id}/members`, member, {
          email: outsider.email,
        })
        .expect(403);
      await api
        .del(`/api/projects/${project.id}/members/${owner.id}`, member)
        .expect(400);
    });

    it('lets a member leave but never lets the owner be removed', async () => {
      const project = await createProject(owner, 'Leaving');
      await api
        .post(`/api/projects/${project.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);

      await api
        .del(`/api/projects/${project.id}/members/${owner.id}`, owner)
        .expect(400);
      await api
        .del(`/api/projects/${project.id}/members/${member.id}`, member)
        .expect(204);
      await api.get(`/api/projects/${project.id}`, member).expect(404);
    });

    it('reports a missing member', async () => {
      const project = await createProject(owner, 'Empty');

      await api
        .del(`/api/projects/${project.id}/members/${outsider.id}`, owner)
        .expect(404);
    });
  });
});
