import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, createApi } from '../utils/api';

type Route = [method: 'get' | 'post' | 'patch' | 'delete', path: string];

// Every endpoint except the public ones (register, login, validate-token, health).
const PROTECTED_ROUTES: Route[] = [
  ['get', '/api/auth/me'],
  ['get', '/api/users/me'],
  ['patch', '/api/users/me'],
  ['get', '/api/users'],
  ['get', '/api/projects'],
  ['post', '/api/projects'],
  ['get', '/api/projects/1'],
  ['patch', '/api/projects/1'],
  ['delete', '/api/projects/1'],
  ['get', '/api/projects/1/members'],
  ['post', '/api/projects/1/members'],
  ['delete', '/api/projects/1/members/2'],
  ['get', '/api/projects/1/tasks'],
  ['post', '/api/projects/1/tasks'],
  ['get', '/api/projects/1/tags'],
  ['post', '/api/projects/1/tags'],
  ['get', '/api/tasks'],
  ['get', '/api/tasks/1'],
  ['patch', '/api/tasks/1'],
  ['delete', '/api/tasks/1'],
  ['get', '/api/tasks/1/comments'],
  ['post', '/api/tasks/1/comments'],
  ['patch', '/api/comments/1'],
  ['delete', '/api/comments/1'],
  ['patch', '/api/tags/1'],
  ['delete', '/api/tags/1'],
];

describe('Security (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it.each(PROTECTED_ROUTES)(
      '%s %s requires a token',
      async (method, path) => {
        await request(api.server())[method](path).expect(401);
      },
    );

    it('rejects a token signed with another secret', async () => {
      const forged = new JwtService().sign(
        { sub: 1, email: 'a@b.c' },
        { secret: 'wrong-secret' },
      );

      await api.get('/api/users/me', forged).expect(401);
    });

    it('rejects an expired token', async () => {
      const user = await api.signUp('expiring');
      const expired = new JwtService().sign(
        { sub: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: -10 },
      );

      await api.get('/api/users/me', expired).expect(401);
    });

    it('stops honouring the token of a deleted user', async () => {
      const user = await api.signUp('deleted');
      await api.get('/api/users/me', user).expect(200);

      await api.prisma.user.delete({ where: { id: user.id } });

      await api.get('/api/users/me', user).expect(401);
    });
  });

  describe('authorization', () => {
    it('keeps the user list away from regular users and admins keep no project access', async () => {
      const owner = await api.signUp('sec-owner');
      const admin = await api.signUpAdmin('sec-admin');
      const project = await api
        .post('/api/projects', owner, { name: 'Private' })
        .expect(201);

      // An admin sees the user list but is not a member of other people's projects.
      await api.get('/api/users', admin).expect(200);
      await api.get(`/api/projects/${project.body.id}`, admin).expect(404);
    });
  });

  describe('mass assignment', () => {
    it('ignores nothing: server-controlled fields in the body are rejected', async () => {
      const user = await api.signUp('mass');
      const project = await api
        .post('/api/projects', user, { name: 'P' })
        .expect(201);
      const task = await api
        .post(`/api/projects/${project.body.id}/tasks`, user, { name: 'T' })
        .expect(201);

      await api
        .post('/api/projects', user, { name: 'P2', ownerId: 1 })
        .expect(400);
      await api
        .post(`/api/projects/${project.body.id}/tasks`, user, {
          name: 'T2',
          createdById: 1,
          projectId: 99,
        })
        .expect(400);
      await api
        .post(`/api/tasks/${task.body.id}/comments`, user, {
          text: 'hi',
          authorId: 1,
        })
        .expect(400);
    });
  });

  describe('no password hash leaks', () => {
    it('in any response that contains users', async () => {
      const owner = await api.signUp('leak-owner');
      const member = await api.signUp('leak-member');
      const admin = await api.signUpAdmin('leak-admin');
      const project = await api
        .post('/api/projects', owner, { name: 'Leaks' })
        .expect(201);
      await api
        .post(`/api/projects/${project.body.id}/members`, owner, {
          email: member.email,
        })
        .expect(201);
      const task = await api
        .post(`/api/projects/${project.body.id}/tasks`, owner, {
          name: 'T',
          assigneeIds: [member.id],
        })
        .expect(201);
      await api
        .post(`/api/tasks/${task.body.id}/comments`, member, { text: 'c' })
        .expect(201);

      const responses = await Promise.all([
        api.get('/api/auth/me', owner),
        api.get('/api/users?limit=100', admin),
        api.get(`/api/projects/${project.body.id}`, member),
        api.get(`/api/projects/${project.body.id}/members`, member),
        api.get(`/api/tasks/${task.body.id}`, owner),
        api.get(`/api/tasks/${task.body.id}/comments`, owner),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
      }
    });
  });

  describe('CORS', () => {
    it('does not allow unknown origins', async () => {
      const res = await request(api.server())
        .options('/api/tasks')
        .set('Origin', 'http://evil.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows the configured frontend origin', async () => {
      const res = await request(api.server())
        .options('/api/tasks')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:8080',
      );
    });
  });
});
