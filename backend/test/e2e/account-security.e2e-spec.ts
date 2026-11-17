import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Api, PASSWORD, TestUser, createApi } from '../utils/api';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';

interface Sent {
  to: string;
  subject: string;
  text: string;
}

/** A mail server that keeps what it was asked to send. */
function fakeTransport() {
  const sent: Sent[] = [];
  return {
    sent,
    transport: {
      sendMail: vi.fn((message: Sent) => {
        sent.push(message);
        return Promise.resolve({});
      }),
    },
  };
}

const NEW_PASSWORD = 'a-brand-new-password';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** `iat` of a JWT has one-second resolution: a change must happen in a later second than the sign-in. */
const NEXT_SECOND = 1100;

describe('Account security (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let mail: ReturnType<typeof fakeTransport>;
  const server = () => app.getHttpServer();

  const emailsTo = (to: string) => mail.sent.filter((item) => item.to === to);
  /** The one-time token from the link in the last email to an address (the link keeps it in the #fragment). */
  const tokenFor = (to: string): string => {
    const text = emailsTo(to).at(-1)?.text ?? '';
    const match = /#token=([A-Za-z0-9_-]+)/.exec(text);
    if (!match) throw new Error(`No link in the emails to ${to}: ${text}`);
    return match[1];
  };
  const loginRaw = (email: string, password = PASSWORD) =>
    request(server()).post('/api/auth/login').send({ email, password });
  const me = async (user: TestUser) =>
    (await api.get('/api/auth/me', user).expect(200)).body as {
      emailVerifiedAt: string | null;
    };
  const forgot = (email: string) =>
    request(server()).post('/api/auth/forgot-password').send({ email });
  const reset = (token: string, password = NEW_PASSWORD) =>
    request(server())
      .post('/api/auth/reset-password')
      .send({ token, password });

  beforeAll(async () => {
    mail = fakeTransport();
    app = await createTestApp({ mailTransport: mail.transport });
    api = createApi(app);
  });

  beforeEach(async () => {
    await cleanDatabase(api.prisma);
    mail.sent.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('email verification', () => {
    it('starts unconfirmed and sends a link by email', async () => {
      const ann = await api.signUp('ann', { verified: false });

      expect((await me(ann)).emailVerifiedAt).toBeNull();
      expect(emailsTo(ann.email)).toHaveLength(1);
      expect(emailsTo(ann.email)[0].text).toContain('/verify-email#token=');
    });

    it('confirms the address with the link, once', async () => {
      const ann = await api.signUp('ann', { verified: false });
      const token = tokenFor(ann.email);

      await request(server())
        .post('/api/auth/verify-email')
        .send({ token })
        .expect(204);
      expect((await me(ann)).emailVerifiedAt).not.toBeNull();

      await request(server())
        .post('/api/auth/verify-email')
        .send({ token })
        .expect(400);
    });

    it('refuses made-up, malformed and foreign-kind tokens alike', async () => {
      const ann = await api.signUp('ann', { verified: false });
      await forgot(ann.email).expect(204);
      const resetToken = tokenFor(ann.email);

      await request(server())
        .post('/api/auth/verify-email')
        .send({ token: 'A'.repeat(43) })
        .expect(400);
      await request(server())
        .post('/api/auth/verify-email')
        .send({ token: 'short' })
        .expect(400);
      await request(server())
        .post('/api/auth/verify-email')
        .send({ token: 'has spaces and ! not allowed ......' })
        .expect(400);
      // A reset link must not confirm an address.
      await request(server())
        .post('/api/auth/verify-email')
        .send({ token: resetToken })
        .expect(400);
    });

    it('refuses an expired link', async () => {
      const ann = await api.signUp('ann', { verified: false });
      const token = tokenFor(ann.email);
      await api.prisma.userToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(server())
        .post('/api/auth/verify-email')
        .send({ token })
        .expect(400);
    });

    it('stores only a hash of the token', async () => {
      const ann = await api.signUp('ann', { verified: false });
      const token = tokenFor(ann.email);

      const rows = await api.prisma.userToken.findMany();

      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('resends the link only to a signed-in, unconfirmed user, and not more than once a minute', async () => {
      const ann = await api.signUp('ann', { verified: false });
      await request(server()).post('/api/auth/resend-verification').expect(401);

      // The registration email counts: asking again at once is quietly ignored.
      await api.post('/api/auth/resend-verification', ann).expect(204);
      expect(emailsTo(ann.email)).toHaveLength(1);

      await api.prisma.userToken.updateMany({
        data: { createdAt: new Date(Date.now() - 120_000) },
      });
      await api.post('/api/auth/resend-verification', ann).expect(204);
      expect(emailsTo(ann.email)).toHaveLength(2);
      // The newest link works, the older one was cancelled.
      await request(server())
        .post('/api/auth/verify-email')
        .send({ token: tokenFor(ann.email) })
        .expect(204);
    });

    it('sends nothing to an address that is already confirmed', async () => {
      const bob = await api.signUp('bob');
      mail.sent.length = 0;

      await api.post('/api/auth/resend-verification', bob).expect(204);

      expect(mail.sent).toHaveLength(0);
    });

    it('keeps notification emails away from unconfirmed addresses, but still notifies them in the app', async () => {
      const owner = await api.signUp('owner');
      const stranger = await api.signUp('stranger', { verified: false });
      const project = (
        await api.post('/api/projects', owner, { name: 'P' }).expect(201)
      ).body.id;
      mail.sent.length = 0;

      await api
        .post(`/api/projects/${project}/members`, owner, {
          email: stranger.email,
        })
        .expect(201);

      expect(
        mail.sent.filter((item) => item.subject.includes('added you')),
      ).toHaveLength(0);
      const inbox = await api.get('/api/notifications', stranger).expect(200);
      expect(inbox.body.items[0]).toMatchObject({ type: 'project.invited' });
    });
  });

  describe('password reset', () => {
    it('emails a link to a known address and says nothing different for an unknown one', async () => {
      const ann = await api.signUp('ann');
      mail.sent.length = 0;

      const known = await forgot(ann.email).expect(204);
      const unknown = await forgot('nobody@example.test').expect(204);

      expect(known.body).toEqual(unknown.body);
      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0].to).toBe(ann.email);
      expect(mail.sent[0].text).toContain('/reset-password#token=');
    });

    it('sends at most one reset email a minute per account', async () => {
      const ann = await api.signUp('ann');
      mail.sent.length = 0;

      await forgot(ann.email).expect(204);
      await forgot(ann.email).expect(204);
      await forgot(ann.email).expect(204);

      expect(mail.sent).toHaveLength(1);
    });

    it('sets the new password: the old one stops working and the new one signs in', async () => {
      const ann = await api.signUp('ann');
      await forgot(ann.email).expect(204);

      await reset(tokenFor(ann.email)).expect(204);

      await loginRaw(ann.email, PASSWORD).expect(401);
      await loginRaw(ann.email, NEW_PASSWORD).expect(201);
    });

    it('ends every existing session: access token and refresh cookie alike', async () => {
      const ann = await api.signUp('ann');
      const signedIn = await loginRaw(ann.email).expect(201);
      const cookie = (
        signedIn.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];
      await api.get('/api/auth/me', signedIn.body.access_token).expect(200);
      await pause(NEXT_SECOND);

      await forgot(ann.email).expect(204);
      await reset(tokenFor(ann.email)).expect(204);

      await api.get('/api/auth/me', signedIn.body.access_token).expect(401);
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
      // A fresh sign-in after the reset works.
      const again = await loginRaw(ann.email, NEW_PASSWORD).expect(201);
      await api.get('/api/auth/me', again.body.access_token).expect(200);
    });

    it('works once only', async () => {
      const ann = await api.signUp('ann');
      await forgot(ann.email).expect(204);
      const token = tokenFor(ann.email);

      await reset(token).expect(204);
      await reset(token, 'yet-another-password').expect(400);

      await loginRaw(ann.email, NEW_PASSWORD).expect(201);
    });

    it('is refused after an hour', async () => {
      const ann = await api.signUp('ann');
      await forgot(ann.email).expect(204);
      const token = tokenFor(ann.email);
      await api.prisma.userToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await reset(token).expect(400);
      await loginRaw(ann.email, PASSWORD).expect(201);
    });

    it('a newer link cancels the older one', async () => {
      const ann = await api.signUp('ann');
      await forgot(ann.email).expect(204);
      const first = tokenFor(ann.email);
      await api.prisma.userToken.updateMany({
        data: { createdAt: new Date(Date.now() - 120_000) },
      });
      await forgot(ann.email).expect(204);

      await reset(first).expect(400);
      await reset(tokenFor(ann.email)).expect(204);
    });

    it('rejects a weak password without spending the link', async () => {
      const ann = await api.signUp('ann');
      await forgot(ann.email).expect(204);
      const token = tokenFor(ann.email);

      await reset(token, 'short').expect(400);
      await reset(token, 'x'.repeat(73)).expect(400);
      await reset(token).expect(204);
    });

    it('also confirms the address, because only its owner can read the link', async () => {
      const ann = await api.signUp('ann', { verified: false });
      await forgot(ann.email).expect(204);

      await reset(tokenFor(ann.email)).expect(204);

      const again = await loginRaw(ann.email, NEW_PASSWORD).expect(201);
      expect(
        (await api.get('/api/auth/me', again.body.access_token).expect(200))
          .body.emailVerifiedAt,
      ).not.toBeNull();
    });

    it('does not accept a confirmation link as a reset link', async () => {
      const ann = await api.signUp('ann', { verified: false });

      await reset(tokenFor(ann.email)).expect(400);
    });

    it('validates the email of the request', async () => {
      await forgot('not-an-email').expect(400);
      await request(server())
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);
    });
  });

  describe('changing the password while signed in', () => {
    it('ends the other sessions and the current token too', async () => {
      const ann = await api.signUp('ann');
      const other = await loginRaw(ann.email).expect(201);
      const otherCookie = (
        other.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];
      await pause(NEXT_SECOND);

      await api
        .patch('/api/users/me', ann, {
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
        })
        .expect(200);

      await api.get('/api/auth/me', ann).expect(401);
      await api.get('/api/auth/me', other.body.access_token).expect(401);
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', otherCookie)
        .expect(401);
      await loginRaw(ann.email, NEW_PASSWORD).expect(201);
    });

    it('keeps the sessions when only the name changes', async () => {
      const ann = await api.signUp('ann');
      await pause(NEXT_SECOND);

      await api.patch('/api/users/me', ann, { name: 'Anna' }).expect(200);

      await api.get('/api/auth/me', ann).expect(200);
    });

    it('refuses a wrong current password and changes nothing', async () => {
      const ann = await api.signUp('ann');

      await api
        .patch('/api/users/me', ann, {
          currentPassword: 'wrong-password',
          newPassword: NEW_PASSWORD,
        })
        .expect(400);

      await api.get('/api/auth/me', ann).expect(200);
      await loginRaw(ann.email, PASSWORD).expect(201);
    });
  });

  describe('account lock after repeated failures', () => {
    const fail = (email: string, times: number) =>
      Array.from({ length: times }).reduce<Promise<unknown>>(
        (chain) =>
          chain.then(() => loginRaw(email, 'wrong-password').expect(401)),
        Promise.resolve(),
      );

    it('locks the account after five wrong passwords, even for the right one', async () => {
      const ann = await api.signUp('ann');

      await fail(ann.email, 5);

      const locked = await loginRaw(ann.email, PASSWORD).expect(429);
      expect(locked.body.message).toMatch(/try again later/i);
    });

    it('counts only consecutive failures: a good sign-in starts over', async () => {
      const ann = await api.signUp('ann');

      await fail(ann.email, 4);
      await loginRaw(ann.email, PASSWORD).expect(201);
      await fail(ann.email, 4);

      await loginRaw(ann.email, PASSWORD).expect(201);
    });

    it('lets the user in again when the lock runs out', async () => {
      const ann = await api.signUp('ann');
      await fail(ann.email, 5);
      await api.prisma.user.update({
        where: { id: ann.id },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });

      await loginRaw(ann.email, PASSWORD).expect(201);
    });

    it('is lifted at once by a password reset', async () => {
      const ann = await api.signUp('ann');
      await fail(ann.email, 5);
      await loginRaw(ann.email, PASSWORD).expect(429);

      await forgot(ann.email).expect(204);
      await reset(tokenFor(ann.email)).expect(204);

      await loginRaw(ann.email, NEW_PASSWORD).expect(201);
    });

    it('treats unknown emails like wrong passwords: 401, never a lock', async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        await loginRaw('nobody@example.test', 'wrong-password').expect(401);
      }
    });

    it('does not let one account lock another', async () => {
      const ann = await api.signUp('ann');
      const bob = await api.signUp('bob');

      await fail(ann.email, 5);

      await loginRaw(bob.email, PASSWORD).expect(201);
    });
  });
});
