import { test as base } from '@playwright/test';
import { BASE_URL, createPerson, type Person } from './helpers';

interface People {
  ann: Person;
  bob: Person;
  eve: Person;
}

/**
 * Three people, created once per worker and shared by the specs. Sign-ups and sign-ins are rate limited,
 * so a spec that made its own accounts would start failing as soon as there were a few of them.
 */
export const test = base.extend<object, { people: People }>({
  people: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext({
        baseURL: BASE_URL,
      });
      const people = {
        ann: await createPerson(request, 'ann'),
        bob: await createPerson(request, 'bob'),
        eve: await createPerson(request, 'eve'),
      };
      await request.dispose();
      await use(people);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
