import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import {
  apiClient,
  getErrorMessage,
  getErrorStatus,
  setUnauthorizedHandler,
} from './api-client';
import { authStorage } from './auth-storage';

/** Runs a request that is expected to fail and returns the error. */
async function failureOf(request: Promise<unknown>): Promise<unknown> {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error('The request was expected to fail');
}

describe('apiClient', () => {
  afterEach(() => setUnauthorizedHandler());

  it('resolves to the response body', async () => {
    server.use(http.get('*/api/ping', () => HttpResponse.json({ pong: true })));

    expect(await apiClient.get('/ping')).toEqual({ pong: true });
  });

  it('sends the stored token as a Bearer header', async () => {
    authStorage.setToken('abc');
    let header: string | null = null;
    server.use(
      http.get('*/api/ping', ({ request }) => {
        header = request.headers.get('authorization');
        return HttpResponse.json({});
      }),
    );

    await apiClient.get('/ping');

    expect(header).toBe('Bearer abc');
  });

  it('sends no Authorization header without a token', async () => {
    let header: string | null = 'untouched';
    server.use(
      http.get('*/api/ping', ({ request }) => {
        header = request.headers.get('authorization');
        return HttpResponse.json({});
      }),
    );

    await apiClient.get('/ping');

    expect(header).toBeNull();
  });

  it('sends JSON bodies with post and patch and resolves delete to nothing', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/things', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
      http.patch('*/api/things/1', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: 1 });
      }),
      http.delete(
        '*/api/things/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    expect(await apiClient.post('/things', { name: 'a' })).toEqual({ id: 1 });
    expect(await apiClient.patch('/things/1', { name: 'b' })).toEqual({
      id: 1,
    });
    expect(await apiClient.delete('/things/1')).toBeUndefined();
    expect(bodies).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  describe('renewing an expired access token', () => {
    const unauthorized = () => new HttpResponse(null, { status: 401 });

    it('refreshes once and repeats the request with the new token', async () => {
      authStorage.setToken('expired');
      const seen: (string | null)[] = [];
      server.use(
        http.get('*/api/secret', ({ request }) => {
          seen.push(request.headers.get('authorization'));
          return request.headers.get('authorization') === 'Bearer fresh'
            ? HttpResponse.json({ ok: true })
            : unauthorized();
        }),
        http.post('*/api/auth/refresh', () =>
          HttpResponse.json({ access_token: 'fresh' }, { status: 201 }),
        ),
      );

      expect(await apiClient.get('/secret')).toEqual({ ok: true });
      expect(seen).toEqual(['Bearer expired', 'Bearer fresh']);
      expect(authStorage.getToken()).toBe('fresh');
    });

    it('shares one refresh between parallel requests, because a refresh token works once', async () => {
      authStorage.setToken('expired');
      let refreshes = 0;
      server.use(
        http.get('*/api/a', ({ request }) =>
          request.headers.get('authorization') === 'Bearer fresh'
            ? HttpResponse.json({ name: 'a' })
            : unauthorized(),
        ),
        http.get('*/api/b', ({ request }) =>
          request.headers.get('authorization') === 'Bearer fresh'
            ? HttpResponse.json({ name: 'b' })
            : unauthorized(),
        ),
        http.post('*/api/auth/refresh', async () => {
          refreshes += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return HttpResponse.json({ access_token: 'fresh' }, { status: 201 });
        }),
      );

      const [a, b] = await Promise.all([
        apiClient.get('/a'),
        apiClient.get('/b'),
      ]);

      expect(a).toEqual({ name: 'a' });
      expect(b).toEqual({ name: 'b' });
      expect(refreshes).toBe(1);
    });

    it('ends the session when the refresh is refused', async () => {
      const onUnauthorized = vi.fn();
      setUnauthorizedHandler(onUnauthorized);
      authStorage.setToken('expired');
      server.use(http.get('*/api/secret', unauthorized));

      const error = await failureOf(apiClient.get('/secret'));

      expect(getErrorStatus(error)).toBe(401);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(authStorage.hasToken()).toBe(false);
    });

    it('gives up after one retry instead of looping', async () => {
      authStorage.setToken('expired');
      let requests = 0;
      server.use(
        http.get('*/api/secret', () => {
          requests += 1;
          return unauthorized();
        }),
        http.post('*/api/auth/refresh', () =>
          HttpResponse.json({ access_token: 'fresh' }, { status: 201 }),
        ),
      );

      const error = await failureOf(apiClient.get('/secret'));

      expect(getErrorStatus(error)).toBe(401);
      expect(requests).toBe(2);
    });

    it.each(['/auth/login', '/auth/register', '/auth/logout'])(
      'does not try to refresh after a 401 from %s',
      async (path) => {
        let refreshes = 0;
        server.use(
          http.post(`*/api${path}`, unauthorized),
          http.post('*/api/auth/refresh', () => {
            refreshes += 1;
            return unauthorized();
          }),
        );

        await failureOf(apiClient.post(path, {}));

        expect(refreshes).toBe(0);
      },
    );

    it('does not report an expired session when there never was a token', async () => {
      const onUnauthorized = vi.fn();
      setUnauthorizedHandler(onUnauthorized);
      server.use(http.get('*/api/secret', unauthorized));

      await failureOf(apiClient.get('/secret'));

      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('expired sessions', () => {
    it('reacts to a 401 when a token is stored', async () => {
      const onUnauthorized = vi.fn();
      setUnauthorizedHandler(onUnauthorized);
      authStorage.setToken('stale');
      server.use(
        http.get('*/api/secret', () => new HttpResponse(null, { status: 401 })),
      );

      await failureOf(apiClient.get('/secret'));

      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('ignores a 401 without a token: that is just a failed login', async () => {
      const onUnauthorized = vi.fn();
      setUnauthorizedHandler(onUnauthorized);
      server.use(
        http.post(
          '*/api/auth/login',
          () => new HttpResponse(null, { status: 401 }),
        ),
      );

      await failureOf(apiClient.post('/auth/login', {}));

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it.each([403, 404, 500])('ignores a %i', async (status) => {
      const onUnauthorized = vi.fn();
      setUnauthorizedHandler(onUnauthorized);
      authStorage.setToken('valid');
      server.use(
        http.get('*/api/thing', () => new HttpResponse(null, { status })),
      );

      await failureOf(apiClient.get('/thing'));

      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });
});

describe('error helpers', () => {
  const fail = (status: number, body: unknown) => {
    server.use(
      http.get('*/api/fail', () =>
        HttpResponse.json(body as object, { status }),
      ),
    );
    return failureOf(apiClient.get('/fail'));
  };

  it('reads the message of the unified API error body', async () => {
    const error = await fail(409, {
      statusCode: 409,
      message: 'Already exists',
    });

    expect(getErrorStatus(error)).toBe(409);
    expect(getErrorMessage(error)).toBe('Already exists');
  });

  it('joins a list of validation messages', async () => {
    const error = await fail(400, {
      message: ['email must be an email', 'name must be a string'],
    });

    expect(getErrorMessage(error)).toBe(
      'email must be an email, name must be a string',
    );
  });

  it('falls back when the body has no message', async () => {
    const error = await fail(500, {});

    expect(getErrorMessage(error)).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getErrorMessage(error, 'Custom fallback')).toBe('Custom fallback');
  });

  it('reports an unreachable server', async () => {
    server.use(http.get('*/api/down', () => HttpResponse.error()));
    const error = await failureOf(apiClient.get('/down'));

    expect(getErrorStatus(error)).toBeUndefined();
    expect(getErrorMessage(error)).toMatch(/cannot reach the server/i);
  });

  it('handles errors that did not come from a request', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined();
    expect(getErrorMessage(new Error('boom'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
