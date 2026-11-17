import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';

export const PASSWORD = 'password-123';

export interface TestUser {
  id: number;
  email: string;
  token: string;
}

/** Thin helpers over supertest so that the e2e specs read as scenarios. */
export function createApi(app: INestApplication) {
  const server = () => app.getHttpServer();
  const prisma = app.get(PrismaService);

  const auth = (user: TestUser | string) => ({
    Authorization: `Bearer ${typeof user === 'string' ? user : user.token}`,
  });

  async function login(email: string): Promise<string> {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.body.access_token;
  }

  /**
   * Registers through the API and logs in. The address is marked as confirmed (as the link in the email
   * would do) unless `verified: false`, so tests of other features are not about email verification.
   */
  async function signUp(
    name: string,
    options: { verified?: boolean } = {},
  ): Promise<TestUser> {
    const email = `${name}@example.test`;
    const res = await request(server())
      .post('/api/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    if (options.verified !== false) {
      await prisma.user.update({
        where: { id: res.body.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { id: res.body.id, email, token: await login(email) };
  }

  /** Admins cannot register themselves, so they are created directly in the database. */
  async function signUpAdmin(name: string): Promise<TestUser> {
    const email = `${name}@example.test`;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(PASSWORD, 4),
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    return { id: user.id, email, token: await login(email) };
  }

  const withAuth = (req: request.Test, user?: TestUser | string) =>
    user ? req.set(auth(user)) : req;

  return {
    server,
    prisma,
    auth,
    signUp,
    signUpAdmin,
    get: (path: string, user?: TestUser | string) =>
      withAuth(request(server()).get(path), user),
    post: (path: string, user?: TestUser | string, body: object = {}) =>
      withAuth(request(server()).post(path), user).send(body),
    patch: (path: string, user?: TestUser | string, body: object = {}) =>
      withAuth(request(server()).patch(path), user).send(body),
    del: (path: string, user?: TestUser | string) =>
      withAuth(request(server()).delete(path), user),
  };
}

export type Api = ReturnType<typeof createApi>;
