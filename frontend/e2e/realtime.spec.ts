import { bearer, browserFor } from './helpers';
import { expect, test } from './fixtures';

// Live updates over the WebSocket, with two real browsers: what one person does appears on the other
// person's screen without a reload. Unit tests fake the socket; this is the only test that proves the
// whole path (API event -> outbox -> Socket.IO -> proxy -> browser -> query cache -> screen).
test('a change made by one person shows up for another without a reload', async ({
  browser,
  request,
  people,
}) => {
  const { ann, bob } = people;

  // Ann owns a project and adds Bob. Both are set up through the API: the browser is for what is being tested.
  const project = await (
    await request.post('/api/projects', {
      headers: bearer(ann),
      data: { name: 'Live board' },
    })
  ).json();
  await request.post(`/api/projects/${project.id}/members`, {
    headers: bearer(ann),
    data: { email: bob.email },
  });

  const bobContext = await browserFor(browser, bob);
  const bobPage = await bobContext.newPage();
  await bobPage.goto(`/projects/${project.id}`);
  await expect(
    bobPage.getByRole('heading', { name: 'Live board' }),
  ).toBeVisible();
  await expect(bobPage.getByText('No tasks yet')).toBeVisible();

  await test.step('a new task appears on the other screen', async () => {
    await request.post(`/api/projects/${project.id}/tasks`, {
      headers: bearer(ann),
      data: { name: 'Written by Ann' },
    });

    // No reload and no navigation: only the socket can have told Bob's page.
    await expect(bobPage.getByText('Written by Ann').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  await test.step('a status change reaches the other screen too', async () => {
    const list = await (
      await request.get(`/api/projects/${project.id}/tasks`, {
        headers: bearer(ann),
      })
    ).json();
    const task = list.items[0];
    await request.patch(`/api/tasks/${task.id}`, {
      headers: bearer(ann),
      data: { version: task.version, status: 'DONE' },
    });

    // The status tabs count tasks per status: the Done tab goes from 0 to 1 without a reload.
    await expect(
      bobPage
        .getByRole('group', { name: 'Status' })
        .getByRole('button', { name: /Done\s*1/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  await test.step('the feed shows what happened', async () => {
    await expect(bobPage.getByText(/created the task/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  await bobContext.close();
});

test('a person who is not a member never hears about a project', async ({
  browser,
  request,
  people,
}) => {
  const { ann, eve } = people;
  const project = await (
    await request.post('/api/projects', {
      headers: bearer(ann),
      data: { name: 'Private plans' },
    })
  ).json();

  const eveContext = await browserFor(browser, eve);
  const evePage = await eveContext.newPage();
  await evePage.goto('/projects');
  await expect(evePage.getByText('No projects yet')).toBeVisible();

  await request.post(`/api/projects/${project.id}/tasks`, {
    headers: bearer(ann),
    data: { name: 'Secret task' },
  });
  // Give the event time to travel: if it leaked, it would be on the screen by now.
  await evePage.waitForTimeout(2000);

  await expect(evePage.getByText('Private plans')).toHaveCount(0);
  await expect(evePage.getByText('Secret task')).toHaveCount(0);
  await eveContext.close();
});
