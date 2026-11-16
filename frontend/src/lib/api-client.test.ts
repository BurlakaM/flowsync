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
