import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { cleanDatabase } from '../utils/db';
import { Api, PASSWORD, createApi } from '../utils/api';

describe('Auth and users (e2e)', () => {
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

  describe('registration', () => {
    it('creates a regular user and never returns the password hash', async () => {
      const res = await api
        .post('/api/auth/register', undefined, {
          name: 'Ann',
          email: 'ann@example.test',
          password: PASSWORD,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Ann',
        email: 'ann@example.test',
        role: 'USER',
      });
      expect(res.body).not.toHaveProperty('password');
    });

    it('trims the name and stores the email in lower case', async () => {
      const res = await api
        .post('/api/auth/register', undefined, {
          name: '  Bob  ',
          email: '  Bob@Example.TEST ',
          password: PASSWORD,
        })
        .expect(201);

      expect(res.body.name).toBe('Bob');
      expect(res.body.email).toBe('bob@example.test');
    });

    it('rejects a duplicate email regardless of its case', async () => {
      await api
        .post('/api/auth/register', undefined, {
          name: 'Dup',
          email: 'ANN@example.test',
          password: PASSWORD,
        })
        .expect(409);
    });

    it.each([
      ['an invalid email', { email: 'nope' }],
      ['a short password', { password: 'short' }],
      ['a password longer than bcrypt reads', { password: 'x'.repeat(73) }],
      ['an empty name', { name: '   ' }],
      ['a role', { role: 'ADMIN' }],
      ['an unknown field', { isAdmin: true }],
    ])('rejects %s', async (_label, override) => {
      await api
        .post('/api/auth/register', undefined, {
          name: 'X',
          email: 'x@example.test',
          password: PASSWORD,
          ...override,
        })
        .expect(400);
    });

    it('no longer accepts registrations on POST /api/users', async () => {
      await api
        .post('/api/users', undefined, {
          name: 'Old',
          email: 'old@example.test',
          password: PASSWORD,
        })
        .expect(404);
    });
  });

  describe('login', () => {
    it('returns an access token', async () => {
      const res = await api
        .post('/api/auth/login', undefined, {
          email: 'ann@example.test',
          password: PASSWORD,
        })
        .expect(201);

      expect(typeof res.body.access_token).toBe('string');
    });

    it('ignores the case of the email', async () => {
      await api
        .post('/api/auth/login', undefined, {
          email: 'Ann@Example.Test',
          password: PASSWORD,
        })
        .expect(201);
    });

    it('answers a wrong password and an unknown email the same way', async () => {
      const wrongPassword = await api
        .post('/api/auth/login', undefined, {
          email: 'ann@example.test',
          password: 'wrong-password',
        })
        .expect(401);
      const unknownEmail = await api
        .post('/api/auth/login', undefined, {
          email: 'nobody@example.test',
          password: PASSWORD,
        })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('keeps the deprecated validate-token endpoint working', async () => {
      const user = await api.signUp('validator');

      const valid = await api
        .post('/api/auth/validate-token', undefined, { token: user.token })
        .expect(201);
      const invalid = await api
        .post('/api/auth/validate-token', undefined, { token: 'garbage' })
        .expect(201);

      expect(valid.body).toEqual({ valid: true });
      expect(invalid.body).toEqual({ valid: false });
    });
  });

  describe('current user', () => {
    it('GET /api/auth/me and GET /api/users/me return the profile', async () => {
      const user = await api.signUp('me');

      const viaAuth = await api.get('/api/auth/me', user).expect(200);
      const viaUsers = await api.get('/api/users/me', user).expect(200);

      expect(viaAuth.body).toEqual(viaUsers.body);
      expect(viaAuth.body).toMatchObject({ id: user.id, email: user.email });
      expect(viaAuth.body).not.toHaveProperty('password');
    });

    it('PATCH /api/users/me changes the name', async () => {
      const user = await api.signUp('rename');

      const res = await api
        .patch('/api/users/me', user, { name: '  New Name ' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('PATCH /api/users/me cannot change the role or the email', async () => {
      const user = await api.signUp('sneaky');

      await api.patch('/api/users/me', user, { role: 'ADMIN' }).expect(400);
      await api
        .patch('/api/users/me', user, { email: 'other@example.test' })
        .expect(400);
    });

    describe('password change', () => {
      it('needs the current password', async () => {
        const user = await api.signUp('pw-missing');

        await api
          .patch('/api/users/me', user, { newPassword: 'another-password' })
          .expect(400);
        await api
          .patch('/api/users/me', user, {
            currentPassword: 'wrong-password',
            newPassword: 'another-password',
          })
          .expect(400);
      });

      it('switches the login to the new password', async () => {
        const user = await api.signUp('pw-change');

        await api
          .patch('/api/users/me', user, {
            currentPassword: PASSWORD,
            newPassword: 'another-password',
          })
          .expect(200);

        await api
          .post('/api/auth/login', undefined, {
            email: user.email,
            password: PASSWORD,
          })
          .expect(401);
        await api
          .post('/api/auth/login', undefined, {
            email: user.email,
            password: 'another-password',
          })
          .expect(201);
      });
    });
  });

  describe('user list (admin only)', () => {
    it('is forbidden for a regular user', async () => {
      const user = await api.signUp('regular');

      await api.get('/api/users', user).expect(403);
    });

    it('lets an admin page through and search the users', async () => {
      const admin = await api.signUpAdmin('admin');

      const all = await api.get('/api/users?limit=2&page=1', admin).expect(200);
      expect(all.body.items).toHaveLength(2);
      expect(all.body.meta.total).toBeGreaterThan(2);
      expect(all.body.meta.totalPages).toBeGreaterThan(1);
      expect(JSON.stringify(all.body)).not.toContain('password');

      const found = await api
        .get('/api/users?search=RENAME', admin)
        .expect(200);
      expect(found.body.items.map((u: { name: string }) => u.name)).toEqual([
        'New Name',
      ]);
    });

    it('validates the paging parameters', async () => {
      const admin = await api.signUpAdmin('admin2');

      await api.get('/api/users?limit=1000', admin).expect(400);
      await api.get('/api/users?page=0', admin).expect(400);
    });
  });
});
