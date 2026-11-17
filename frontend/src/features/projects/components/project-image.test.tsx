import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { apiClient } from '@/lib/api-client';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { Project } from '../types';
import { ProjectImage } from './project-image';
import { ProjectImageField } from './project-image-field';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 7,
  name: 'Roadmap',
  description: null,
  hasImage: false,
  ownerId: 1,
  myRole: 'OWNER',
  tasksCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

describe('ProjectImage', () => {
  it('shows the first letter while the project has no picture, and asks for nothing', () => {
    renderWithProviders(<ProjectImage project={project()} />);

    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('downloads the picture with the access token and shows it', async () => {
    let authorization: string | null = null;
    server.use(
      http.get('*/api/projects/7/image', ({ request }) => {
        authorization = request.headers.get('authorization');
        return new HttpResponse(PNG_BYTES, {
          headers: { 'Content-Type': 'image/png' },
        });
      }),
    );
    const { authStorage } = await import('@/lib/auth-storage');
    authStorage.setToken('jwt-token');
    renderWithProviders(<ProjectImage project={project({ hasImage: true })} />);

    const image = await screen.findByRole('img', {
      name: 'Picture of the project Roadmap',
    });
    expect(image).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    expect(authorization).toBe('Bearer jwt-token');
  });

  it('keeps the letter when the picture cannot be loaded', async () => {
    server.use(
      http.get('*/api/projects/7/image', () =>
        HttpResponse.json({ statusCode: 404 }, { status: 404 }),
      ),
    );
    renderWithProviders(<ProjectImage project={project({ hasImage: true })} />);

    await waitFor(() => expect(screen.getByText('R')).toBeInTheDocument());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('ProjectImageField', () => {
  const pick = (file: File) =>
    userEvent
      .setup({ applyAccept: false })
      .upload(screen.getByLabelText('Picture'), file);
  const png = (size = 11) =>
    new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });

  it('sends the chosen picture as a multipart file', async () => {
    // Not through MSW: the jsdom FormData and File cannot be turned into a request by the Node 24 fetch
    // implementation that MSW uses ("expected a File"), although a real browser does it. The wire format is
    // covered by the Playwright test (e2e/project-image.spec.ts); here we check what the form builds.
    const put = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValue(project({ hasImage: true }));
    renderWithProviders(<ProjectImageField project={project()} />);

    await pick(png());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [url, body] = put.mock.calls[0];
    expect(url).toBe('/projects/7/image');
    const file = (body as FormData).get('file') as File;
    expect(file.name).toBe('logo.png');
    expect(file.type).toBe('image/png');
    put.mockRestore();
  });

  it('refuses a file of the wrong type or size without asking the server', async () => {
    let requests = 0;
    server.use(
      http.put('*/api/projects/7/image', () => {
        requests += 1;
        return HttpResponse.json(project());
      }),
    );
    renderWithProviders(<ProjectImageField project={project()} />);

    await pick(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a PNG, JPEG or WebP image.',
    );

    await pick(png(2 * 1024 * 1024 + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The picture is larger than 2 MB.',
    );
    expect(requests).toBe(0);
  });

  it('shows what the server says when it refuses the picture', async () => {
    server.use(
      http.put('*/api/projects/7/image', () =>
        HttpResponse.json(
          {
            statusCode: 503,
            message: 'File storage is not configured on this server.',
          },
          { status: 503 },
        ),
      ),
    );
    renderWithProviders(<ProjectImageField project={project()} />);

    await pick(png());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File storage is not configured on this server.',
    );
  });

  it('offers to remove a picture that exists, and removes it', async () => {
    let removed = false;
    server.use(
      http.get(
        '*/api/projects/7/image',
        () =>
          new HttpResponse(PNG_BYTES, {
            headers: { 'Content-Type': 'image/png' },
          }),
      ),
      http.delete('*/api/projects/7/image', () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectImageField project={project({ hasImage: true })} />,
    );

    expect(
      screen.getByRole('button', { name: 'Change picture' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove picture' }));

    await waitFor(() => expect(removed).toBe(true));
  });

  it('offers no removal when there is no picture', () => {
    renderWithProviders(<ProjectImageField project={project()} />);

    expect(
      screen.getByRole('button', { name: 'Choose a picture' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove picture' }),
    ).not.toBeInTheDocument();
  });
});
