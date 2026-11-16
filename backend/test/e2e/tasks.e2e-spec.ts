import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: number;
  let tagBug: number;
  let tagFeature: number;
  let foreignTag: number;

  const names = (res: { body: { items: { name: string }[] } }) =>
    res.body.items.map((task) => task.name);

  const createTask = async (
    user: TestUser,
    body: object,
    project = projectId,
  ) =>
    (await api.post(`/api/projects/${project}/tasks`, user, body).expect(201))
      .body;

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');

    projectId = (
      await api.post('/api/projects', owner, { name: 'Main' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);
    tagBug = (
      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: 'bug' })
        .expect(201)
    ).body.id;
    tagFeature = (
      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: 'feature' })
        .expect(201)
    ).body.id;

    const foreignProject = (
      await api.post('/api/projects', outsider, { name: 'Foreign' }).expect(201)
    ).body.id;
    foreignTag = (
      await api
        .post(`/api/projects/${foreignProject}/tags`, outsider, { name: 'x' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create', () => {
    it('lets a member create a task and records the author', async () => {
      const task = await createTask(member, {
        name: '  First  ',
        description: 'd',
      });

      expect(task).toMatchObject({
        name: 'First',
        description: 'd',
        status: 'TODO',
        projectId,
        createdById: member.id,
        createdBy: { id: member.id, name: 'member' },
        project: { id: projectId, name: 'Main' },
        assignees: [],
        tags: [],
        commentsCount: 0,
      });
    });

    it('stores the assignees and the tags', async () => {
      const task = await createTask(owner, {
        name: 'With people',
        status: 'IN_PROGRESS',
        assigneeIds: [member.id, owner.id],
        tagIds: [tagBug],
      });

      expect(task.status).toBe('IN_PROGRESS');
      expect(task.assignees.map((a: { id: number }) => a.id).sort()).toEqual(
        [owner.id, member.id].sort(),
      );
      expect(task.tags).toEqual([{ id: tagBug, name: 'bug' }]);
    });

    it('hides the project from outsiders', async () => {
      await api
        .post(`/api/projects/${projectId}/tasks`, outsider, { name: 'Nope' })
        .expect(404);
    });

    it.each([
      ['an empty name', () => ({ name: '' })],
      ['an unknown status', () => ({ name: 'T', status: 'ARCHIVED' })],
      [
        'an assignee outside the project',
        () => ({ name: 'T', assigneeIds: [outsider.id] }),
      ],
      [
        'duplicate assignees',
        () => ({ name: 'T', assigneeIds: [member.id, member.id] }),
      ],
      ['a tag of another project', () => ({ name: 'T', tagIds: [foreignTag] })],
      ['a non-numeric id', () => ({ name: 'T', tagIds: ['x'] })],
      ['a project id in the body', () => ({ name: 'T', projectId: 1 })],
    ])('rejects %s', async (_label, body) => {
      await api
        .post(`/api/projects/${projectId}/tasks`, owner, body())
        .expect(400);
    });
  });

  describe('list', () => {
    let listProject: number;

    beforeAll(async () => {
      listProject = (
        await api.post('/api/projects', owner, { name: 'Lists' }).expect(201)
      ).body.id;
      await api
        .post(`/api/projects/${listProject}/members`, owner, {
          email: member.email,
        })
        .expect(201);
      const bug = (
        await api
          .post(`/api/projects/${listProject}/tags`, owner, { name: 'bug' })
          .expect(201)
      ).body.id;
      const feature = (
        await api
          .post(`/api/projects/${listProject}/tags`, owner, { name: 'feature' })
          .expect(201)
      ).body.id;

      const create = (body: object) => createTask(owner, body, listProject);
      await create({
        name: 'Alpha',
        status: 'TODO',
        assigneeIds: [member.id],
        tagIds: [bug],
      });
      await create({
        name: 'Bravo',
        status: 'IN_PROGRESS',
        assigneeIds: [owner.id],
      });
      await create({ name: 'Charlie', status: 'DONE', tagIds: [feature] });
      await create({ name: 'Delta', description: 'Fix the login redirect' });
      await create({ name: 'Echo' });
    });

    const list = (query: string, user = owner) =>
      api.get(`/api/projects/${listProject}/tasks?${query}`, user);

    it('paginates', async () => {
      const res = await list('limit=2&page=3&sortBy=name&order=asc').expect(
        200,
      );

      expect(names(res)).toEqual(['Echo']);
      expect(res.body.meta).toEqual({
        page: 3,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('sorts by name in both directions', async () => {
      expect(names(await list('sortBy=name&order=asc').expect(200))).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
      ]);
      expect(
        names(await list('sortBy=name&order=desc&limit=2').expect(200)),
      ).toEqual(['Echo', 'Delta']);
    });

    it('filters by status, assignee and tag', async () => {
      expect(names(await list('status=DONE').expect(200))).toEqual(['Charlie']);
      expect(names(await list(`assigneeId=${member.id}`).expect(200))).toEqual([
        'Alpha',
      ]);
      expect(names(await list('status=TODO').expect(200)).sort()).toEqual([
        'Alpha',
        'Delta',
        'Echo',
      ]);
    });

    it('filters by tag', async () => {
      const bug = (
        await api.get(`/api/projects/${listProject}/tags`, owner).expect(200)
      ).body.find((tag: { name: string }) => tag.name === 'bug');

      expect(names(await list(`tagId=${bug.id}`).expect(200))).toEqual([
        'Alpha',
      ]);
    });

    it('searches the name and the description case-insensitively, by the beginning of a word', async () => {
      expect(names(await list('search=DEL').expect(200))).toEqual(['Delta']);
      expect(names(await list('search=LOGIN').expect(200))).toEqual(['Delta']);
    });

    it('validates the query', async () => {
      await list('sortBy=password').expect(400);
      await list('status=NOPE').expect(400);
      await list('assigneeId=abc').expect(400);
      await list('order=sideways').expect(400);
    });

    it('is a 404 for outsiders instead of an empty page', async () => {
      await list('', outsider).expect(404);
    });

    it('GET /api/tasks lists the tasks of every project the user can see', async () => {
      const mine = await api.get('/api/tasks?limit=100', member).expect(200);
      const theirs = await api
        .get('/api/tasks?limit=100', outsider)
        .expect(200);

      expect(names(mine)).toEqual(expect.arrayContaining(['Alpha', 'First']));
      expect(names(theirs)).toEqual([]);

      const scoped = await api
        .get(`/api/tasks?projectId=${listProject}&limit=100`, member)
        .expect(200);
      expect(scoped.body.meta.total).toBe(5);

      const foreign = await api
        .get(`/api/tasks?projectId=${listProject}`, outsider)
        .expect(200);
      expect(foreign.body.items).toEqual([]);
    });
  });

  describe('details', () => {
    it('shows a task to members only', async () => {
      const task = await createTask(owner, { name: 'Details' });

      const res = await api.get(`/api/tasks/${task.id}`, member).expect(200);
      expect(res.body.id).toBe(task.id);

      await api.get(`/api/tasks/${task.id}`, outsider).expect(404);
      await api.get('/api/tasks/not-a-number', owner).expect(400);
      await api.get('/api/tasks/999999', owner).expect(404);
    });
  });

  describe('update', () => {
    it('changes the fields and keeps the lists when they are omitted', async () => {
      const task = await createTask(owner, {
        name: 'Old',
        assigneeIds: [member.id],
        tagIds: [tagBug],
      });

      const res = await api
        .patch(`/api/tasks/${task.id}`, member, { name: 'New', status: 'DONE' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'New', status: 'DONE' });
      expect(res.body.assignees).toHaveLength(1);
      expect(res.body.tags).toHaveLength(1);
    });

    it('replaces or clears the assignees and the tags when they are sent', async () => {
      const task = await createTask(owner, {
        name: 'Lists',
        assigneeIds: [member.id],
        tagIds: [tagBug],
      });

      const replaced = await api
        .patch(`/api/tasks/${task.id}`, owner, {
          assigneeIds: [owner.id],
          tagIds: [tagFeature],
        })
        .expect(200);
      expect(replaced.body.assignees).toEqual([
        { id: owner.id, name: 'owner' },
      ]);
      expect(replaced.body.tags).toEqual([{ id: tagFeature, name: 'feature' }]);

      const cleared = await api
        .patch(`/api/tasks/${task.id}`, owner, { assigneeIds: [], tagIds: [] })
        .expect(200);
      expect(cleared.body.assignees).toEqual([]);
      expect(cleared.body.tags).toEqual([]);
    });

    it('rejects people and tags that do not belong to the project', async () => {
      const task = await createTask(owner, { name: 'Strict' });

      await api
        .patch(`/api/tasks/${task.id}`, owner, { assigneeIds: [outsider.id] })
        .expect(400);
      await api
        .patch(`/api/tasks/${task.id}`, owner, { tagIds: [foreignTag] })
        .expect(400);
      await api.patch(`/api/tasks/${task.id}`, owner, { name: '' }).expect(400);
    });

    it('is a 404 for outsiders', async () => {
      const task = await createTask(owner, { name: 'Mine' });

      await api
        .patch(`/api/tasks/${task.id}`, outsider, { name: 'x' })
        .expect(404);
    });
  });

  describe('delete', () => {
    it('lets the author delete the task', async () => {
      const task = await createTask(member, { name: 'Own' });

      await api.del(`/api/tasks/${task.id}`, member).expect(204);
      await api.get(`/api/tasks/${task.id}`, member).expect(404);
    });

    it('lets the project owner delete a task of a member', async () => {
      const task = await createTask(member, { name: 'Moderated' });

      await api.del(`/api/tasks/${task.id}`, owner).expect(204);
    });

    it('forbids other members and hides the task from outsiders', async () => {
      const task = await createTask(owner, { name: 'Protected' });

      await api.del(`/api/tasks/${task.id}`, member).expect(403);
      await api.del(`/api/tasks/${task.id}`, outsider).expect(404);
      await api.get(`/api/tasks/${task.id}`, owner).expect(200);
    });
  });

  describe('full-text search', () => {
    let searchProject: number;
    let foreignProject: number;

    const search = (term: string, extra = '', user = owner) =>
      api.get(
        `/api/projects/${searchProject}/tasks?search=${encodeURIComponent(term)}${extra}`,
        user,
      );

    beforeAll(async () => {
      searchProject = (
        await api.post('/api/projects', owner, { name: 'Search' }).expect(201)
      ).body.id;
      foreignProject = (
        await api
          .post('/api/projects', outsider, { name: 'Foreign' })
          .expect(201)
      ).body.id;

      await createTask(owner, { name: 'Deploy checklist' }, searchProject);
      await createTask(
        owner,
        { name: 'Docs', description: 'Describe the deploy steps' },
        searchProject,
      );
      const commented = await createTask(
        owner,
        { name: 'Unrelated title' },
        searchProject,
      );
      await api
        .post(`/api/tasks/${commented.id}/comments`, owner, {
          text: 'Blocked until the zeppelin arrives',
        })
        .expect(201);
      await createTask(
        outsider,
        { name: 'Deploy secrets', description: 'zeppelin' },
        foreignProject,
      );
    });

    it('finds words in the name, the description and the comments', async () => {
      expect(names(await search('checklist').expect(200))).toEqual([
        'Deploy checklist',
      ]);
      expect(names(await search('steps').expect(200))).toEqual(['Docs']);
      expect(names(await search('zeppelin').expect(200))).toEqual([
        'Unrelated title',
      ]);
    });

    it('requires every word and accepts the beginning of a word', async () => {
      expect(names(await search('deploy chec').expect(200))).toEqual([
        'Deploy checklist',
      ]);
      expect(names(await search('deploy zeppelin').expect(200))).toEqual([]);
    });

    it('puts the best match first when asked for relevance', async () => {
      const res = await search('deploy', '&sortBy=relevance').expect(200);

      // A hit in the name outweighs a hit in the description.
      expect(names(res)).toEqual(['Deploy checklist', 'Docs']);
      expect(res.body.meta.total).toBe(2);
    });

    it('pages the relevance order', async () => {
      const first = await search('deploy', '&sortBy=relevance&limit=1').expect(
        200,
      );
      const second = await search(
        'deploy',
        '&sortBy=relevance&limit=1&page=2',
      ).expect(200);

      expect(names(first)).toEqual(['Deploy checklist']);
      expect(names(second)).toEqual(['Docs']);
      expect(second.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    });

    it('never finds tasks of projects the user cannot see', async () => {
      // "Deploy secrets" and its description exist, but in a foreign project.
      const all = await api
        .get('/api/tasks?search=zeppelin', owner)
        .expect(200);
      expect(names(all)).toEqual(['Unrelated title']);

      const relevance = await api
        .get('/api/tasks?search=secrets&sortBy=relevance', owner)
        .expect(200);
      expect(names(relevance)).toEqual([]);
      await search('secrets', '', outsider).expect(404);
    });

    it('treats operators and quotes as plain text instead of failing', async () => {
      for (const term of ["'; DROP TABLE tasks; --", '!(deploy) | &', 'a:*b']) {
        await search(term).expect(200);
      }
      expect(names(await search('!!!').expect(200))).toEqual([]);
      await api.get(`/api/projects/${searchProject}/tasks`, owner).expect(200);
    });

    it('keeps combining the search with the other filters', async () => {
      expect(names(await search('deploy', '&status=DONE').expect(200))).toEqual(
        [],
      );
      expect(
        names(await search('deploy', '&status=TODO').expect(200)),
      ).toHaveLength(2);
    });
  });
});
