/// <reference lib="dom" />
import { bearer, browserFor } from './helpers';
import { expect, test } from './fixtures';

// A 1x1 PNG: the server decides by the bytes of the file, not by its name, so the test uploads a real image.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHhyXQgAAAABJRU5ErkJggg==',
  'base64',
);

test('a project picture is uploaded through the file chooser, shown, and removed', async ({
  browser,
  request,
  people,
}) => {
  const { ann } = people;
  const project = await (
    await request.post('/api/projects', {
      headers: bearer(ann),
      data: { name: 'With a picture' },
    })
  ).json();

  // The storage is optional (S3 credentials); a stack that has none answers 503 to an upload. Ask once up
  // front, so the test says "skipped: no storage" instead of failing for a reason that is not a bug.
  const probe = await request.put(`/api/projects/${project.id}/image`, {
    headers: bearer(ann),
    multipart: {
      file: { name: 'probe.png', mimeType: 'image/png', buffer: PNG_1X1 },
    },
  });
  test.skip(
    probe.status() === 503,
    'file storage is not configured in this stack',
  );
  expect(probe.status()).toBe(200);
  await request.delete(`/api/projects/${project.id}/image`, {
    headers: bearer(ann),
  });

  const context = await browserFor(browser, ann);
  const page = await context.newPage();
  await page.goto(`/projects/${project.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const picture = page
    .getByRole('img', { name: 'Picture of the project With a picture' })
    .first();

  await test.step('choose a file', async () => {
    // The input is visually hidden; setInputFiles drives it the way the native chooser would.
    await dialog.getByLabel('Picture').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });

    await expect(
      dialog.getByRole('button', { name: 'Remove picture' }),
    ).toBeVisible();
    await expect(picture).toBeVisible();
  });

  await test.step('the picture survives a reload (it is stored, not only shown)', async () => {
    await page.reload();
    await expect(picture).toBeVisible();
    // The browser fetched real image bytes through the API, with the access token.
    const loaded = await picture.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    );
    expect(loaded).toBe(true);
  });

  await test.step('a file that is not an image is refused with a message', async () => {
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Picture')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not an image'),
      });

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Choose a PNG, JPEG or WebP image.',
    );
  });

  await test.step('remove the picture', async () => {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove picture' })
      .click();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('button', { name: 'Choose a picture' }),
    ).toBeVisible();
  });

  await context.close();
});
