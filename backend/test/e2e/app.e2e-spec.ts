import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

describe('Application foundation (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('is public and reports the database as up', async () => {
      const res = await request(server()).get('/api/health').expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.info.database.status).toBe('up');
    });
  });

  describe('error format', () => {
    it('returns the unified body for an unknown route', async () => {
      const res = await request(server()).get('/api/nope').expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: '/api/nope',
      });
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('returns the unified body for a missing token', async () => {
      const res = await request(server()).get('/api/tasks').expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        path: '/api/tasks',
      });
    });

    it('lists every validation problem as an array of messages', async () => {
      const res = await request(server())
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('maps a unique-constraint violation to 409 instead of 500', async () => {
      const user = {
        name: 'dup',
        email: 'dup@example.test',
        password: 'password-123',
      };
      await request(server()).post('/api/auth/register').send(user).expect(201);

      const res = await request(server())
        .post('/api/auth/register')
        .send(user)
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toContain('email');
    });
  });

  describe('hardening', () => {
    it('sends security headers', async () => {
      const res = await request(server()).get('/api/health').expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
