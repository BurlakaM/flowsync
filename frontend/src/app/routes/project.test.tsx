import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { chooseOption, renderApp } from '@/testing/test-utils';

const ann = {
  id: 1,
  name: 'Ann',
  email: 'ann@example.test',
  role: 'USER',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const projectDetails = (myRole: 'OWNER' | 'MEMBER' = 'OWNER') => ({
  id: 7,
  name: 'Roadmap',
  description: 'Plans for the year',
  hasImage: false,
  ownerId: 1,
  myRole,
  tasksCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  owner: { id: 1, name: 'Ann' },
  members: [
    {
      userId: 1,
      name: 'Ann',
      email: 'ann@example.test',
      role: 'OWNER',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      userId: 2,
      name: 'Bob',
      email: 'bob@example.test',
      role: 'MEMBER',
      joinedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
});

const task = (id: number, name: string) => ({
  id,
  name,
  description: null,
  status: 'TODO',
  projectId: 7,
  createdById: 1,
  assignees: [{ id: 2, name: 'Bob' }],
  tags: [{ id: 5, name: 'bug' }],
  commentsCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const taskPage = (items: unknown[], totalPages = 1) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages },
});

const tag = {
  id: 5,
  name: 'bug',
  projectId: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  authStorage.setToken('jwt-token');
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json(ann)),
    http.get('*/api/projects/7', () => HttpResponse.json(projectDetails())),
    http.get('*/api/projects/7/tags', () => HttpResponse.json([tag])),
    http.get('*/api/projects/7/activity', () =>
      HttpResponse.json({
        items: [],
        meta: { page: 1, limit: 15, total: 0, totalPages: 0 },
      }),
    ),
  );
});

describe('project page', () => {
  it('shows the project, its tasks, members and tags', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(taskPage([task(9, 'Fix login')])),
      ),
    );
    renderApp('/projects/7');

    expect(
      await screen.findByRole('heading', { name: 'Roadmap' }),
    ).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Fix login' });
    expect(link).toHaveAttribute('href', '/tasks/9');
    expect(screen.getByText('2 comments')).toBeInTheDocument();
    expect(screen.getByText('bob@example.test')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Delete tag bug' }),
    ).toBeInTheDocument();
  });

  it('hides owner-only controls from a plain member', async () => {
    server.use(
      http.get('*/api/projects/7', () =>
        HttpResponse.json(projectDetails('MEMBER')),
      ),
      http.get('*/api/projects/7/tasks', () => HttpResponse.json(taskPage([]))),
    );
    renderApp('/projects/7');

    await screen.findByRole('heading', { name: 'Roadmap' });
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New tag')).not.toBeInTheDocument();
  });

  it('shows "not found" for a project the user cannot see', async () => {
    server.use(
      http.get('*/api/projects/7', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Project not found' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/projects/7');

    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('shows the empty state of a project without tasks', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () => HttpResponse.json(taskPage([]))),
    );
    renderApp('/projects/7');

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  it('shows an error with a retry for the tasks, not an empty list', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Boom' },
          { status: 500 },
        ),
      ),
    );
    renderApp('/projects/7');

    const alert = await screen.findByText('Could not load tasks');
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
  });

  it('keeps filters in the URL and sends them to the API', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get('*/api/projects/7/tasks', ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json(taskPage([task(9, 'Fix login')], 3));
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects/7');

    await screen.findByRole('link', { name: 'Fix login' });
    await user.click(screen.getByRole('button', { name: /^Done/ }));
    await chooseOption(user, screen.getByLabelText('Assignee'), 'Bob');
    await chooseOption(user, screen.getByLabelText('Sort by'), 'Name A–Z');

    await screen.findByText('Page 1 of 3');
    expect(router.state.location.search).toBe(
      '?status=DONE&assigneeId=2&sortBy=name&order=asc',
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(router.state.location.search).toContain('page=2');

    // The status tabs ask for one task each to learn their counts: only the list itself has the full page.
    const last = queries.filter((query) => query.get('limit') !== '1').at(-1);
    expect(last?.get('status')).toBe('DONE');
    expect(last?.get('assigneeId')).toBe('2');
    expect(last?.get('sortBy')).toBe('name');
    expect(last?.get('limit')).toBe('20');
  });

  it('shows how many tasks each status has and how far the project has come', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        const total = { TODO: 2, IN_PROGRESS: 1, DONE: 3 }[status ?? ''] ?? 99;
        return HttpResponse.json({
          items: [task(9, 'Fix login')],
          meta: { page: 1, limit: 20, total, totalPages: 1 },
        });
      }),
    );
    renderApp('/projects/7');

    expect(
      await screen.findByRole('button', { name: /^Alls*6$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^To dos*2$/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Dones*3$/ })).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: 'Progress' }),
    ).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3 of 6 done')).toBeInTheDocument();
  });

  it('shows the tasks as a board and asks for as many as one request allows', async () => {
    const limits: (string | null)[] = [];
    server.use(
      http.get('*/api/projects/7/tasks', ({ request }) => {
        limits.push(new URL(request.url).searchParams.get('limit'));
        return HttpResponse.json(taskPage([task(9, 'Fix login')]));
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects/7');

    await screen.findByRole('link', { name: 'Fix login' });
    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(
      await screen.findByRole('region', { name: /To do/ }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=board');
    await waitFor(() => expect(limits.at(-1)).toBe('100'));

    await user.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('shows the best matches first after a search and returns to the default order when it is cleared', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(taskPage([task(9, 'Fix login')])),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects/7');
    await screen.findByRole('link', { name: 'Fix login' });
    expect(
      screen.queryByRole('option', { name: 'Best match' }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tasks'), 'login');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(router.state.location.search).toBe(
        '?search=login&sortBy=relevance&order=desc',
      ),
    );
    expect(screen.getByLabelText('Sort by')).toHaveTextContent('Best match');

    await user.clear(screen.getByLabelText('Search tasks'));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('offers to clear the filters when nothing matches', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () => HttpResponse.json(taskPage([]))),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects/7?status=DONE');

    expect(
      await screen.findByText('No tasks match the filters'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('creates a task and opens it', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () => HttpResponse.json(taskPage([]))),
      http.post('*/api/projects/7/tasks', () =>
        HttpResponse.json(
          {
            ...task(11, 'Write docs'),
            project: { id: 7, name: 'Roadmap' },
            createdBy: { id: 1, name: 'Ann' },
          },
          { status: 201 },
        ),
      ),
      http.get('*/api/tasks/11', () =>
        HttpResponse.json({
          ...task(11, 'Write docs'),
          project: { id: 7, name: 'Roadmap' },
          createdBy: { id: 1, name: 'Ann' },
        }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects/7');

    await screen.findByText('No tasks yet');
    const dialogTrigger = screen.getAllByRole('button', {
      name: 'New task',
    })[0];
    await user.click(dialogTrigger);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Write docs');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create task' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Write docs' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tasks/11');
  });
});
