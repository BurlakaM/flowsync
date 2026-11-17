import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';

export const PASSWORD = 'password-123';

/** A fresh, unique name per run: the tests need no seed data and leave nothing that could clash. */
export const unique = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The address the tests talk to: nginx in the production-like stack, the Vite dev server in development. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

/** A signed-up person: the access token for API calls and the refresh cookie that signs a browser in. */
export interface Person {
  name: string;
  email: string;
  token: string;
  /** The value of the `refresh_token` cookie: what the API gave at sign-in. */
  refreshCookie: string;
}

export const bearer = (person: Pick<Person, 'token'>) => ({
  Authorization: `Bearer ${person.token}`,
});

/**
 * Registers and signs in through the API, once. The API limits sign-ups and sign-ins to five a minute per
 * address, so the tests must not sign in through the form again and again: a browser is signed in with the
 * refresh cookie instead (see `browserFor`), exactly what a returning visitor's browser holds.
 */
export async function createPerson(
  request: APIRequestContext,
  label: string,
): Promise<Person> {
  const name = `E2E ${label}`;
  const email = `e2e-${label.toLowerCase()}-${unique()}@example.test`;

  const registered = await request.post('/api/auth/register', {
    data: { name, email, password: PASSWORD },
  });
  expect(registered.status(), `registering ${label}`).toBe(201);

  const login = await request.post('/api/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), `signing in ${label}`).toBe(201);
  const setCookie = login
    .headersArray()
    .find(
      (header) =>
        header.name.toLowerCase() === 'set-cookie' &&
        header.value.startsWith('refresh_token='),
    );
  const refreshCookie = setCookie?.value.split(';')[0].split('=')[1] ?? '';
  expect(refreshCookie, 'refresh cookie of the sign-in').not.toBe('');

  return {
    name,
    email,
    token: (await login.json()).access_token as string,
    refreshCookie,
  };
}

/**
 * A browser window of its own, already signed in as the person: the app restores the session from the
 * refresh cookie when it starts. Use each person's cookie in one window only (a refresh token is used once).
 */
export async function browserFor(
  browser: Browser,
  person: Person,
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addCookies([
    {
      name: 'refresh_token',
      value: person.refreshCookie,
      domain: new URL(BASE_URL).hostname,
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  return context;
}
