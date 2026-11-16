import { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, TestUser, createApi } from '../utils/api';

interface Heard {
  type: string;
  projectId: number;
  entityType: string;
  entityId: number;
  taskId?: number;
}

const connectionOptions = (token?: string) => ({
  path: '/api/socket.io',
  transports: ['websocket'],
  reconnection: false,
  auth: token === undefined ? {} : { token },
});

/** A browser: connects with a token and remembers what it was told. */
class Client {
  readonly events: Heard[] = [];
  notifications = 0;

  private constructor(readonly socket: Socket) {
    socket.on('domain', (event: Heard) => this.events.push(event));
    socket.on('notification', () => (this.notifications += 1));
  }

  static async connect(url: string, token?: string): Promise<Client> {
    const socket = io(url, connectionOptions(token));
    const client = new Client(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('ready', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });
    return client;
  }

  /** The message of the refusal; fails when the connection is accepted. */
  static rejected(url: string, token?: string): Promise<string> {
    const socket = io(url, connectionOptions(token));
    return new Promise((resolve, reject) => {
      socket.once('connect_error', (error) => {
        socket.close();
        resolve(error.message);
      });
      socket.once('ready', () => {
        socket.close();
        reject(new Error('the connection was accepted'));
      });
    });
  }

  /** Resolves once an event matching the predicate has arrived (it may have arrived already). */
  async heard(
    match: (event: Heard) => boolean,
    timeout = 3000,
  ): Promise<Heard> {
    const started = Date.now();
    for (;;) {
      const found = this.events.find(match);
      if (found) return found;
      if (Date.now() - started > timeout) {
        throw new Error(`Not heard: ${JSON.stringify(this.events)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  close() {
    this.socket.close();
  }
}

const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Real-time updates (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let url: string;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: number;
  const clients: Client[] = [];

  const connect = async (user: TestUser) => {
    const client = await Client.connect(url, user.token);
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    url = await app.getUrl();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    owner = await api.signUp('owner');
    member = await api.signUp('member');
    outsider = await api.signUp('outsider');
    projectId = (
      await api.post('/api/projects', owner, { name: 'Live' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('connecting', () => {
    it('needs a valid access token', async () => {
      expect(await Client.rejected(url)).toBe('unauthorized');
      expect(await Client.rejected(url, 'garbage')).toBe('unauthorized');
    });

    it('rejects a token of a user who no longer exists', async () => {
      const temp = await api.signUp('temp');
      await api.prisma.user.delete({ where: { id: temp.id } });

      expect(await Client.rejected(url, temp.token)).toBe('unauthorized');
    });

    it('accepts a valid token', async () => {
      await connect(owner);
    });
  });

  describe('what a client hears', () => {
    it('hears the changes of a project it belongs to, as a light event without the data', async () => {
      const listening = await connect(member);

      const task = (
        await api
          .post(`/api/projects/${projectId}/tasks`, owner, {
            name: 'Secret plan',
          })
          .expect(201)
      ).body;

      const event = await listening.heard(
        (item) => item.type === 'task.created',
      );
      expect(event).toEqual({
        type: 'task.created',
        projectId,
        entityType: 'Task',
        entityId: task.id,
      });
      expect(JSON.stringify(listening.events)).not.toContain('Secret plan');
    });

    it('tells a comment together with its task', async () => {
      const listening = await connect(owner);
      const task = (
        await api
          .post(`/api/projects/${projectId}/tasks`, owner, { name: 'Chat' })
          .expect(201)
      ).body;

      await api
        .post(`/api/tasks/${task.id}/comments`, member, { text: 'hi' })
        .expect(201);

      expect(
        await listening.heard((item) => item.type === 'comment.created'),
      ).toMatchObject({ taskId: task.id, entityType: 'Comment' });
    });

    it('hears nothing about projects it cannot see', async () => {
      const outside = await connect(outsider);

      await api
        .post(`/api/projects/${projectId}/tasks`, owner, { name: 'Hidden' })
        .expect(201);
      await pause();

      expect(outside.events).toEqual([]);
    });

    it('hears about a project created after it connected', async () => {
      const listening = await connect(outsider);
      const mine = (
        await api.post('/api/projects', outsider, { name: 'Mine' }).expect(201)
      ).body.id;

      await api
        .post(`/api/projects/${mine}/tags`, outsider, { name: 'new' })
        .expect(201);

      expect(
        await listening.heard(
          (item) => item.type === 'tag.created' && item.projectId === mine,
        ),
      ).toBeDefined();
    });
  });

  describe('access changes while connected', () => {
    it('starts to hear a project when added to it, and stops when removed', async () => {
      const guest = await api.signUp('guest');
      const listening = await connect(guest);

      await api
        .post(`/api/projects/${projectId}/members`, owner, {
          email: guest.email,
        })
        .expect(201);
      await listening.heard((item) => item.type === 'member.added');

      await api
        .post(`/api/projects/${projectId}/tags`, owner, { name: 'welcome' })
        .expect(201);
      await listening.heard((item) => item.type === 'tag.created');

      await api
        .del(`/api/projects/${projectId}/members/${guest.id}`, owner)
        .expect(204);
      await listening.heard((item) => item.type === 'member.removed');
      const heardBefore = listening.events.length;

      await api
        .post(`/api/projects/${projectId}/tags`, owner, {
          name: 'after-leaving',
        })
        .expect(201);
      await pause();

      expect(listening.events).toHaveLength(heardBefore);
    });

    it('is told when a project is deleted', async () => {
      const doomed = (
        await api.post('/api/projects', owner, { name: 'Doomed' }).expect(201)
      ).body.id;
      const listening = await connect(owner);
      await api.del(`/api/projects/${doomed}`, owner).expect(204);

      await listening.heard((item) => item.type === 'project.deleted');
    });
  });

  describe('notifications', () => {
    it('rings the bell of the person who was assigned, and of nobody else', async () => {
      const assignee = await connect(member);
      const author = await connect(owner);
      const bystander = await connect(outsider);

      await api
        .post(`/api/projects/${projectId}/tasks`, owner, {
          name: 'Assigned live',
          assigneeIds: [member.id],
        })
        .expect(201);

      await vi.waitFor(() => expect(assignee.notifications).toBe(1));
      await pause();
      expect(author.notifications).toBe(0);
      expect(bystander.notifications).toBe(0);
    });
  });
});
