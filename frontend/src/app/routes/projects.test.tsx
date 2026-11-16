import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { renderApp } from '@/testing/test-utils';

const ann = {
  id: 1,
  name: 'Ann',
  email: 'ann@example.test',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const project = (id: number, name: string, myRole = 'OWNER') => ({
  id,
  name,
  description: `${name} description`,
  hasImage: false,
  ownerId: 1,
  myRole,
  tasksCount: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const page = (items: unknown[], pageNumber = 1, totalPages = 1) => ({
  items,
  meta: {
    page: pageNumber,
    limit: 12,
    total: items.length,
    totalPages,
  },
});

beforeEach(() => {
  authStorage.setToken('jwt-token');
  server.use(http.get('*/api/auth/me', () => HttpResponse.json(ann)));
});

describe('projects page', () => {
  it('lists the projects with links to them', async () => {
    server.use(
      http.get('*/api/projects', () =>
        HttpResponse.json(
          page([project(1, 'Roadmap'), project(2, 'Website', 'MEMBER')]),
        ),
      ),
    );
    renderApp('/projects');

    const link = await screen.findByRole('link', { name: 'Roadmap' });
    expect(link).toHaveAttribute('href', '/projects/1');
    expect(screen.getByRole('link', { name: 'Website' })).toBeInTheDocument();
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Owner')).toHaveLength(1);
  });

  it('offers to create the first project when there are none', async () => {
    server.use(
      http.get('*/api/projects', () => HttpResponse.json(page([], 1, 0))),
    );
    renderApp('/projects');

    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getAllByRole('button', {
        name: 'New project',
      }),
    ).not.toHaveLength(0);
  });

  it('shows an error with a retry instead of an empty list', async () => {
    let failing = true;
    server.use(
      http.get('*/api/projects', () =>
        failing
          ? HttpResponse.json(
              { statusCode: 500, message: 'Boom' },
              { status: 500 },
            )
          : HttpResponse.json(page([project(1, 'Roadmap')])),
      ),
    );
    const user = userEvent.setup();
    renderApp('/projects');

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('link', { name: 'Roadmap' }),
    ).toBeInTheDocument();
  });

  it('keeps the search and the page in the URL and sends them to the API', async () => {
    const queries: string[] = [];
    server.use(
      http.get('*/api/projects', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json(page([project(1, 'Roadmap')], 1, 3));
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects');

    await screen.findByRole('link', { name: 'Roadmap' });
    await user.type(screen.getByLabelText('Search projects'), 'road');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('Page 1 of 3');
    expect(router.state.location.search).toBe('?search=road');
    expect(queries.at(-1)).toContain('search=road');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('link', { name: 'Roadmap' });
    expect(router.state.location.search).toContain('page=2');
    expect(queries.at(-1)).toContain('page=2');
  });

  it('creates a project and opens it', async () => {
    server.use(
      http.get('*/api/projects', () => HttpResponse.json(page([], 1, 0))),
      http.post('*/api/projects', () =>
        HttpResponse.json(project(5, 'Fresh'), { status: 201 }),
      ),
      http.get('*/api/projects/5', () =>
        HttpResponse.json({
          ...project(5, 'Fresh'),
          owner: { id: 1, name: 'Ann' },
          members: [],
        }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects');

    await user.click(
      (await screen.findAllByRole('button', { name: 'New project' }))[0],
    );
    await user.type(await screen.findByLabelText('Name'), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByRole('heading', { name: 'Fresh' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/5');
  });
});
