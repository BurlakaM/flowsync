import { expect, test } from '@playwright/test';

// A fresh account per run: the test needs no seed data and leaves nothing that could clash next time.
const unique = Date.now().toString(36);
const user = {
  name: 'E2E User',
  email: `e2e-${unique}@example.test`,
  password: 'password-123',
};

test('a new user signs up, creates a project and a task, comments, reloads and signs out', async ({
  page,
}) => {
  await test.step('sign up (the account signs in at once)', async () => {
    await page.goto('/register');
    await page.getByLabel('Name').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText('No projects yet')).toBeVisible();
  });

  await test.step('create a project', async () => {
    await page
      .getByRole('main')
      .getByRole('button', { name: 'New project' })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel('Name').fill('Launch');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page.getByRole('heading', { name: 'Launch' })).toBeVisible();
    await expect(page.getByText('No tasks yet')).toBeVisible();
  });

  await test.step('create a task', async () => {
    await page.getByRole('button', { name: 'New task' }).first().click();
    await page
      .getByRole('dialog')
      .getByLabel('Name')
      .fill('Write the announcement');
    await page.getByRole('button', { name: 'Create task' }).click();

    await expect(
      page.getByRole('heading', { name: 'Write the announcement' }),
    ).toBeVisible();
  });

  await test.step('change the status and add a comment', async () => {
    await page
      .getByRole('combobox', { name: 'Status of Write the announcement' })
      .selectOption('DONE');
    await expect(
      page.getByRole('combobox', { name: 'Status of Write the announcement' }),
    ).toHaveValue('DONE');

    await page.getByLabel('Add a comment').fill('Ready to publish');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();

    await expect(page.getByText('Ready to publish')).toBeVisible();
  });

  await test.step('a reload keeps the session and the data', async () => {
    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Write the announcement' }),
    ).toBeVisible();
    await expect(page.getByText('Ready to publish')).toBeVisible();
    // The access token lives in memory only: nothing sensitive is left in localStorage.
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });

  await test.step('sign out ends the session for good', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprojects$/);
  });

  await test.step('signing in again shows the same project', async () => {
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('link', { name: 'Launch' })).toBeVisible();
  });
});
