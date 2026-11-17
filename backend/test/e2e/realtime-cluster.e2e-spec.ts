import { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { Api, TestUser, createApi } from '../utils/api';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

// Needs a Redis: TEST_REDIS_URL=redis://localhost:6380 locally (the development compose publishes it);
// CI provides a service container. Without it the file is skipped, not failed.
const redisUrl = process.env.TEST_REDIS_URL;

const connect = (url: string, token: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(url, {
      path: '/api/socket.io',
      transports: ['websocket'],
      reconnection: false,
      auth: { token },
    });
    socket.once('ready', () => resolve(socket));
    socket.once('connect_error', reject);
  });

/** Resolves with the first `domain` event of the given type, or rejects when it never comes. */
const heard = (socket: Socket, type: string, timeout = 2000) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    socket.on('domain', (event: { type: string }) => {
      if (event.type !== type) return;
      clearTimeout(timer);
      resolve(true);
    });
  });

describe.skipIf(!redisUrl)('Live updates across API instances (e2e)', () => {
  const apps: INestApplication[] = [];
  const sockets: Socket[] = [];

  /** Two API instances on one database, as two containers behind a proxy would be. */
  async function startCluster(withRedis: boolean) {
    const [a, b] = await Promise.all(
      [0, 1].map(() => createTestApp(withRedis ? { redisUrl } : {})),
    );
    apps.push(a, b);
    await a.listen(0);
    await b.listen(0);
    return { a, b, urlA: await a.getUrl(), urlB: await b.getUrl() };
  }

  async function scenario(withRedis: boolean) {
    const { a, urlA, urlB } = await startCluster(withRedis);
    const api: Api = createApi(a);
    await cleanDatabase(api.prisma);
    const owner: TestUser = await api.signUp('owner');
    const member: TestUser = await api.signUp('member');
    const projectId = (
      await api.post('/api/projects', owner, { name: 'Cluster' }).expect(201)
    ).body.id;
    await api
      .post(`/api/projects/${projectId}/members`, owner, {
        email: member.email,
      })
      .expect(201);

    // The owner is on instance A, the member on instance B.
    sockets.push(await connect(urlA, owner.token));
    const memberSocket = await connect(urlB, member.token);
    sockets.push(memberSocket);
    const heardByMember = heard(memberSocket, 'task.created');

    // The change happens on instance A.
    await api
      .post(`/api/projects/${projectId}/tasks`, owner, { name: 'Across' })
      .expect(201);
    return heardByMember;
  }

  afterEach(async () => {
    sockets.splice(0).forEach((socket) => socket.close());
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('delivers an update from one instance to a browser connected to the other', async () => {
    expect(await scenario(true)).toBe(true);
  });

  it('would not without the adapter: the other instance never hears about it', async () => {
    // The control: proves the test above is sensitive to the adapter and not passing by accident.
    expect(await scenario(false)).toBe(false);
  });
});
