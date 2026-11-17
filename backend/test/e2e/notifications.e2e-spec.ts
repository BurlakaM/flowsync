import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

interface Sent {
  from?: string;
  to: string;
  subject: string;
  text: string;
}

interface Notification {
  id: number;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
}

/** A mail server that keeps what it was asked to send (or refuses everything). */
function fakeTransport(failWith?: Error) {
  const sent: Sent[] = [];
  return {
    sent,
    transport: {
      sendMail: vi.fn((message: Sent) => {
        if (failWith) return Promise.reject(failWith);
        sent.push(message);
        return Promise.resolve({});
      }),
    },
  };
}

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let mail: ReturnType<typeof fakeTransport>;
  let owner: TestUser;
  let member: TestUser;
  let other: TestUser;
  let outsider: TestUser;
  let projectId: number;

  const inbox = async (user: TestUser, query = '') =>
    (await api.get(`/api/notifications${query}`, user).expect(200)).body as {
      items: Notification[];
      meta: { total: number };
    };
  const unread = async (user: TestUser) =>
    (await api.get('/api/notifications/unread-count', user).expect(200)).body
      .count as number;

  beforeAll(async () => {
    mail = fakeTransport();
    app = await createTestApp({ mailTransport: mail.transport });
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    other = await api.signUp('other');
    outsider = await api.signUp('outsider');
    projectId = (
      await api.post('/api/projects', owner, { name: 'Launch' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it.each([
      ['get', '/api/notifications'],
      ['get', '/api/notifications/unread-count'],
      ['post', '/api/notifications/read-all'],
      ['post', '/api/notifications/1/read'],
    ] as const)('%s %s needs a token', async (method, path) => {
      await (method === 'get' ? api.get(path) : api.post(path)).expect(401);
    });

    it('validates the query', async () => {
      await api.get('/api/notifications?limit=1000', owner).expect(400);
      await api.get('/api/notifications?unread=maybe', owner).expect(400);
    });
  });

  describe('when someone is added to a project', () => {
    it('invites them in the application and by email', async () => {
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: member.email,
        })
        .expect(201);
      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: other.email,
        })
        .expect(201);

      const [invite] = (await inbox(member)).items;
      expect(invite).toMatchObject({
        type: 'project.invited',
        readAt: null,
        data: { actorName: 'owner', projectId, projectName: 'Launch' },
      });
      const email = mail.sent.find((item) => item.to === member.email);
      expect(email?.subject).toBe('owner added you to “Launch”');
      expect(email?.text).toContain(`/projects/${projectId}`);
    });

    it('does not tell the owner about what the owner did', async () => {
      expect((await inbox(owner)).items).toEqual([]);
      expect(mail.sent.some((item) => item.to === owner.email)).toBe(false);
    });
  });

  describe('assignments and comments', () => {
    let taskId: number;

    it('notifies the people a task is assigned to', async () => {
      taskId = (
        await api
          .post(`/api/projects/${projectId}/tasks`, owner, {
            name: 'Write announcement',
            assigneeIds: [member.id],
          })
          .expect(201)
      ).body.id;

      const notifications = (await inbox(member)).items;
      expect(notifications[0]).toMatchObject({
        type: 'task.assigned',
        data: { taskId, taskName: 'Write announcement', actorName: 'owner' },
      });
      expect(
        mail.sent.find((item) => item.subject.includes('assigned you')),
      ).toMatchObject({
        to: member.email,
        text: expect.stringContaining(`/tasks/${taskId}`),
      });
    });

    it('notifies only the people added by a later update', async () => {
      const before = (await inbox(member)).meta.total;

      await api
        .patch(`/api/tasks/${taskId}`, owner, {
          version: 1,
          assigneeIds: [member.id, other.id],
        })
        .expect(200);

      expect((await inbox(member)).meta.total).toBe(before);
      expect((await inbox(other)).items[0]).toMatchObject({
        type: 'task.assigned',
      });
    });

    it('tells the author and the assignees about a comment, but not its writer', async () => {
      const ownerBefore = (await inbox(owner)).meta.total;
      const memberBefore = (await inbox(member)).meta.total;
      const otherBefore = (await inbox(other)).meta.total;

      await api
        .post(`/api/tasks/${taskId}/comments`, member, { text: 'On it!' })
        .expect(201);

      expect((await inbox(owner)).meta.total).toBe(ownerBefore + 1);
      expect((await inbox(other)).meta.total).toBe(otherBefore + 1);
      expect((await inbox(member)).meta.total).toBe(memberBefore);
      expect((await inbox(owner)).items[0]).toMatchObject({
        type: 'comment.added',
        data: { excerpt: 'On it!', taskName: 'Write announcement' },
      });
    });

    it('never tells someone outside the project anything', async () => {
      expect((await inbox(outsider)).items).toEqual([]);
      expect(mail.sent.some((item) => item.to === outsider.email)).toBe(false);
    });
  });

  describe('reading', () => {
    it('counts, filters and marks notifications as read', async () => {
      const total = (await inbox(member)).meta.total;
      expect(await unread(member)).toBe(total);

      const [latest] = (await inbox(member)).items;
      await api
        .post(`/api/notifications/${latest.id}/read`, member)
        .expect(204);

      expect(await unread(member)).toBe(total - 1);
      expect((await inbox(member, '?unread=true')).meta.total).toBe(total - 1);
      expect(
        (await inbox(member)).items.find((item) => item.id === latest.id)
          ?.readAt,
      ).not.toBeNull();
    });

    it("hides someone else's notification instead of marking it", async () => {
      const [mine] = (await inbox(member)).items;

      await api
        .post(`/api/notifications/${mine.id}/read`, outsider)
        .expect(404);
      await api.post('/api/notifications/999999/read', member).expect(404);
    });

    it('marks everything as read for the user only', async () => {
      const otherUnread = await unread(other);
      expect(otherUnread).toBeGreaterThan(0);

      await api.post('/api/notifications/read-all', member).expect(204);

      expect(await unread(member)).toBe(0);
      expect(await unread(other)).toBe(otherUnread);
    });

    it('pages the list', async () => {
      const first = await inbox(other, '?limit=1');
      const second = await inbox(other, '?limit=1&page=2');

      expect(first.items).toHaveLength(1);
      expect(second.items[0].id).not.toBe(first.items[0].id);
    });
  });

  it('removes the notifications of a deleted user', async () => {
    const temp = await api.signUp('temp');
    await api
      .post(`/api/projects/${projectId}/members`, owner, { email: temp.email })
      .expect(201);
    expect(await unread(temp)).toBe(1);

    await api.prisma.user.delete({ where: { id: temp.id } });

    expect(
      await api.prisma.notification.count({ where: { userId: temp.id } }),
    ).toBe(0);
  });
});

describe('Notifications without email (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    // The test environment has no SMTP settings: this is the application as it is before email is connected.
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('still notifies in the application, and nothing fails', async () => {
    const owner = await api.signUp('owner');
    const member = await api.signUp('member');
    const projectId = (
      await api.post('/api/projects', owner, { name: 'Quiet' }).expect(201)
    ).body.id;

    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);

    const { items } = (await api.get('/api/notifications', member).expect(200))
      .body;
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('project.invited');
  });
});

describe('Notifications with a broken mail server (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  const mail = fakeTransport(new Error('connection refused'));

  beforeAll(async () => {
    app = await createTestApp({ mailTransport: mail.transport });
    api = createApi(app);
    await cleanDatabase(api.prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the request normally and keeps the notification', async () => {
    const owner = await api.signUp('owner');
    const member = await api.signUp('member');
    const projectId = (
      await api
        .post('/api/projects', owner, { name: 'Broken mail' })
        .expect(201)
    ).body.id;

    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);

    expect(mail.transport.sendMail).toHaveBeenCalled();
    const { items } = (await api.get('/api/notifications', member).expect(200))
      .body;
    expect(items).toHaveLength(1);
  });
});
