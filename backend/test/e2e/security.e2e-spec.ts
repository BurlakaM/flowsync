import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

const email = (name: string) => `${name}@example.test`;
const PASSWORD = 'password-123';

describe('Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(name: string) {
    const res = await request(server())
      .post('/api/users')
      .send({ name, email: email(name), password: PASSWORD })
      .expect(201);
    return res.body as { id: number; email: string; role: string };
  }

  async function login(name: string): Promise<string> {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: email(name), password: PASSWORD })
      .expect(201);
    return res.body.access_token;
  }

  function createProject(ownerId: number) {
    return prisma.project.create({
      data: { name: 'p', description: 'd', image: 'i', ownerId },
    });
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('registration and login', () => {
    it('registers a user without exposing the password hash', async () => {
      const res = await request(server())
        .post('/api/users')
        .send({ name: 'reg', email: email('reg'), password: PASSWORD })
        .expect(201);

      expect(res.body.email).toBe(email('reg'));
      expect(res.body).not.toHaveProperty('password');
    });

    it('always registers a regular user', async () => {
      const user = await register('regular');

      expect(user.role).toBe('USER');
    });

    it('rejects a client-supplied role', async () => {
      await request(server())
        .post('/api/users')
        .send({
          name: 'x',
          email: email('role'),
          password: PASSWORD,
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('rejects an invalid email', async () => {
      await request(server())
        .post('/api/users')
        .send({ name: 'x', email: 'not-an-email', password: PASSWORD })
        .expect(400);
    });

    it('rejects an invalid login body', async () => {
      await request(server()).post('/api/auth/login').send({}).expect(400);
    });

    it('rejects a wrong password with 401', async () => {
      await register('wrongpass');
      await request(server())
        .post('/api/auth/login')
        .send({ email: email('wrongpass'), password: 'definitely-wrong' })
        .expect(401);
    });
  });

  describe('users', () => {
    it('no longer exposes users by email', async () => {
      await request(server())
        .get(`/api/users/${email('reg')}`)
        .expect(404);
    });

    it('requires a token for GET /users/me', async () => {
      await request(server()).get('/api/users/me').expect(401);
    });

    it('returns the own profile without the password hash', async () => {
      const user = await register('me');
      const token = await login('me');

      const res = await request(server())
        .get('/api/users/me')
        .set(bearer(token))
        .expect(200);

      expect(res.body.id).toBe(user.id);
      expect(res.body).not.toHaveProperty('password');
    });

    it('rejects a token signed with another secret', async () => {
      const forged = new JwtService().sign(
        { sub: 1, email: 'a@b.c' },
        { secret: 'wrong-secret' },
      );
      await request(server())
        .get('/api/users/me')
        .set(bearer(forged))
        .expect(401);
    });
  });

  describe('tasks', () => {
    it('requires a token', async () => {
      await request(server()).get('/api/tasks').expect(401);
      await request(server())
        .post('/api/tasks')
        .send({ name: 'n', description: 'd', projectId: 1 })
        .expect(401);
    });

    it('creates a task in the own project with the author taken from the token', async () => {
      const owner = await register('task-owner');
      const token = await login('task-owner');
      const project = await createProject(owner.id);

      const res = await request(server())
        .post('/api/tasks')
        .set(bearer(token))
        .send({ name: 'n', description: 'd', projectId: project.id })
        .expect(201);

      expect(res.body.createdById).toBe(owner.id);
    });

    it('rejects an author id in the body', async () => {
      const owner = await register('task-spoof');
      const token = await login('task-spoof');
      const project = await createProject(owner.id);

      await request(server())
        .post('/api/tasks')
        .set(bearer(token))
        .send({
          name: 'n',
          description: 'd',
          projectId: project.id,
          createdById: 1,
        })
        .expect(400);
    });

    it("returns 404 when creating a task in someone else's project", async () => {
      const owner = await register('proj-owner');
      await register('intruder');
      const intruderToken = await login('intruder');
      const project = await createProject(owner.id);

      await request(server())
        .post('/api/tasks')
        .set(bearer(intruderToken))
        .send({ name: 'n', description: 'd', projectId: project.id })
        .expect(404);
    });

    it('lists only the own tasks', async () => {
      const alice = await register('alice');
      await register('bob');
      const aliceToken = await login('alice');
      const bobToken = await login('bob');
      const project = await createProject(alice.id);

      const created = await request(server())
        .post('/api/tasks')
        .set(bearer(aliceToken))
        .send({ name: 'secret', description: 'd', projectId: project.id })
        .expect(201);

      const bobList = await request(server())
        .get('/api/tasks')
        .set(bearer(bobToken))
        .expect(200);
      const aliceList = await request(server())
        .get('/api/tasks')
        .set(bearer(aliceToken))
        .expect(200);

      expect(bobList.body.map((t: { id: number }) => t.id)).not.toContain(
        created.body.id,
      );
      expect(aliceList.body.map((t: { id: number }) => t.id)).toContain(
        created.body.id,
      );
    });
  });

  describe('comments', () => {
    it('requires a token', async () => {
      await request(server())
        .post('/api/comments')
        .send({ text: 't', taskId: 1 })
        .expect(401);
    });

    it('creates a comment on an own task with the author taken from the token', async () => {
      const owner = await register('c-owner');
      const token = await login('c-owner');
      const project = await createProject(owner.id);
      const task = await request(server())
        .post('/api/tasks')
        .set(bearer(token))
        .send({ name: 'n', description: 'd', projectId: project.id })
        .expect(201);

      const res = await request(server())
        .post('/api/comments')
        .set(bearer(token))
        .send({ text: 'hello', taskId: task.body.id })
        .expect(201);

      expect(res.body.authorId).toBe(owner.id);
    });

    it('rejects an author id in the body', async () => {
      await request(server())
        .post('/api/comments')
        .set(
          bearer(
            await (async () => {
              await register('c-spoof');
              return login('c-spoof');
            })(),
          ),
        )
        .send({ text: 't', taskId: 1, authorId: 1 })
        .expect(400);
    });

    it('returns 404 when commenting on a task the user cannot see', async () => {
      const owner = await register('c-task-owner');
      const ownerToken = await login('c-task-owner');
      await register('c-stranger');
      const strangerToken = await login('c-stranger');
      const project = await createProject(owner.id);
      const task = await request(server())
        .post('/api/tasks')
        .set(bearer(ownerToken))
        .send({ name: 'n', description: 'd', projectId: project.id })
        .expect(201);

      await request(server())
        .post('/api/comments')
        .set(bearer(strangerToken))
        .send({ text: 'hi', taskId: task.body.id })
        .expect(404);
    });
  });

  describe('CORS', () => {
    it('does not allow unknown origins', async () => {
      const res = await request(server())
        .options('/api/tasks')
        .set('Origin', 'http://evil.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows the configured frontend origin', async () => {
      const res = await request(server())
        .options('/api/tasks')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:8080',
      );
    });
  });
});
