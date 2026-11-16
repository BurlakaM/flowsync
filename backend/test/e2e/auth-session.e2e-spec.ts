import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, PASSWORD, createApi } from '../utils/api';

const COOKIE = 'refresh_token';

/** The `Set-Cookie` header of the refresh cookie, as a string. */
function refreshCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (header ?? []).find((value) => value.startsWith(`${COOKIE}=`)) ?? '';
}

/** `refresh_token=abc` from a Set-Cookie header: what a browser sends back. */
const cookieValue = (setCookie: string) => setCookie.split(';')[0];

describe('Sessions with refresh tokens (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  const login = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });

  const refresh = (cookie?: string) => {
    const req = request(app.getHttpServer()).post('/api/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  beforeAll(async () => {
    app = await createTestApp();
    api = createApi(app);
    await cleanDatabase(api.prisma);
    await api.signUp('sam');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('login', () => {
    it('sets the refresh token as an httpOnly, SameSite=Strict cookie scoped to the auth routes', async () => {
      const res = await login('sam@example.test').expect(201);

      const cookie = refreshCookie(res);
      expect(cookie).toMatch(/^refresh_token=.{40,};/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth(;|$)/);
      expect(cookie).toMatch(/Expires=/i);
      // COOKIE_SECURE is off in tests: the cookie has to work over plain http.
      expect(cookie).not.toMatch(/Secure/i);
      expect(typeof res.body.access_token).toBe('string');
      expect(JSON.stringify(res.body)).not.toContain('refresh');
    });

    it('stores only the hash of the token', async () => {
      const res = await login('sam@example.test').expect(201);
      const token = cookieValue(refreshCookie(res)).split('=')[1];

      const rows = await api.prisma.refreshToken.findMany();

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row.tokenHash === token)).toBe(false);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('does not set a cookie for wrong credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'sam@example.test', password: 'wrong-password' })
        .expect(401);

      expect(refreshCookie(res)).toBe('');
    });
  });

  describe('refresh', () => {
    it('answers 401 without a cookie', async () => {
      await refresh().expect(401);
    });

    it('answers 401 for a token that was never issued', async () => {
      const res = await refresh(`${COOKIE}=made-up`).expect(401);

      // The useless cookie is cleared.
      expect(refreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/i);
    });

    it('returns a working access token and rotates the cookie', async () => {
      const first = await login('sam@example.test').expect(201);
      const firstCookie = cookieValue(refreshCookie(first));

      const second = await refresh(firstCookie).expect(201);

      const secondCookie = cookieValue(refreshCookie(second));
      expect(secondCookie).not.toBe(firstCookie);
      expect(secondCookie).toMatch(/^refresh_token=.{40,}$/);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${second.body.access_token}`)
        .expect(200);
    });

    it('lets the rotated token be used again, one step at a time', async () => {
      const first = await login('sam@example.test').expect(201);
      const second = await refresh(cookieValue(refreshCookie(first))).expect(
        201,
      );

      await refresh(cookieValue(refreshCookie(second))).expect(201);
    });

    it('treats the replay of a spent token as theft and revokes the whole sign-in', async () => {
      const first = await login('sam@example.test').expect(201);
      const firstCookie = cookieValue(refreshCookie(first));
      const second = await refresh(firstCookie).expect(201);
      const secondCookie = cookieValue(refreshCookie(second));

      // Pretend the first token was spent a while ago, outside the tolerance for parallel tabs.
      const hash = await api.prisma.refreshToken.findMany({
        where: { revokedAt: { not: null } },
        orderBy: { id: 'desc' },
        take: 1,
      });
      await api.prisma.refreshToken.update({
        where: { id: hash[0].id },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });

      await refresh(firstCookie).expect(401);
      // The thief's replay also killed the legitimate newest token of the family.
      await refresh(secondCookie).expect(401);
    });

    it('keeps the family alive when a token arrives twice at almost the same moment', async () => {
      const first = await login('sam@example.test').expect(201);
      const firstCookie = cookieValue(refreshCookie(first));
      const second = await refresh(firstCookie).expect(201);

      // Right after the rotation (a second tab): rejected, but the new token still works.
      await refresh(firstCookie).expect(401);
      await refresh(cookieValue(refreshCookie(second))).expect(201);
    });

    it('rejects an expired token', async () => {
      const res = await login('sam@example.test').expect(201);
      const cookie = cookieValue(refreshCookie(res));
      await api.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      await refresh(cookie).expect(401);
    });

    it('does not mix up sign-ins: another family is not affected by a revocation', async () => {
      const laptop = await login('sam@example.test').expect(201);
      const phone = await login('sam@example.test').expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookieValue(refreshCookie(laptop)))
        .expect(204);

      await refresh(cookieValue(refreshCookie(laptop))).expect(401);
      await refresh(cookieValue(refreshCookie(phone))).expect(201);
    });
  });

  describe('logout', () => {
    it('revokes the sign-in, clears the cookie and answers 204', async () => {
      const res = await login('sam@example.test').expect(201);
      const cookie = cookieValue(refreshCookie(res));

      const out = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(refreshCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/i);
      await refresh(cookie).expect(401);
    });

    it('never fails, even without a cookie', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });
  });

  describe('access tokens', () => {
    it('are short-lived by default', async () => {
      const res = await login('sam@example.test').expect(201);
      const payload = JSON.parse(
        Buffer.from(
          res.body.access_token.split('.')[1],
          'base64url',
        ).toString(),
      );

      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('are not accepted from the refresh cookie', async () => {
      const res = await login('sam@example.test').expect(201);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookieValue(refreshCookie(res)))
        .expect(401);
    });
  });

  it('deletes the refresh tokens of a deleted user', async () => {
    const user = await api.signUp('gone');
    await login('gone@example.test').expect(201);

    await api.prisma.user.delete({ where: { id: user.id } });

    expect(
      await api.prisma.refreshToken.count({ where: { userId: user.id } }),
    ).toBe(0);
  });
});
