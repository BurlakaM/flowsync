import { screen } from '@testing-library/react';
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
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const taskDetails = {
  id: 9,
  name: 'Fix login',
  description: 'It fails on Safari',
  status: 'IN_PROGRESS',
  projectId: 7,
  createdById: 1,
  assignees: [{ id: 2, name: 'Bob' }],
  tags: [{ id: 5, name: 'bug' }],
  commentsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  project: { id: 7, name: 'Roadmap' },
  createdBy: { id: 1, name: 'Ann' },
};

beforeEach(() => {
  authStorage.setToken('jwt-token');
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json(ann)),
    http.get('*/api/projects/7', () =>
      HttpResponse.json({
        id: 7,
        name: 'Roadmap',
        description: null,
        hasImage: false,
        ownerId: 1,
        myRole: 'OWNER',
        tasksCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        owner: { id: 1, name: 'Ann' },
        members: [],
      }),
    ),
    http.get('*/api/projects/7/tags', () => HttpResponse.json([])),
    http.get('*/api/tasks/9/comments', () =>
      HttpResponse.json({
        items: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    ),
  );
});

describe('task page', () => {
  it('shows the details of the task with a link back to its project', async () => {
    server.use(http.get('*/api/tasks/9', () => HttpResponse.json(taskDetails)));
    renderApp('/tasks/9');

    expect(
      await screen.findByRole('heading', { name: 'Fix login' }),
    ).toBeInTheDocument();
    expect(screen.getByText('It fails on Safari')).toBeInTheDocument();
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/by Ann/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Roadmap/ })).toHaveAttribute(
      'href',
      '/projects/7',
    );
  });

  it('shows "not found" for a task the user cannot see', async () => {
    server.use(
      http.get('*/api/tasks/9', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Task not found' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/tasks/9');

    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('shows the comments of the task', async () => {
    server.use(
      http.get('*/api/tasks/9', () => HttpResponse.json(taskDetails)),
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              text: 'Looks reproducible',
              taskId: 9,
              author: { id: 2, name: 'Bob' },
              createdAt: '2026-01-01T10:00:00.000Z',
              updatedAt: '2026-01-01T10:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      ),
    );
    renderApp('/tasks/9');

    expect(await screen.findByText('Looks reproducible')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Comments' }),
    ).toBeInTheDocument();
  });

  it('answers a malformed id without asking the API', async () => {
    renderApp('/tasks/abc');

    expect(await screen.findByText('Task not found')).toBeInTheDocument();
  });

  it('deletes the task after the confirmation and returns to the project', async () => {
    server.use(
      http.get('*/api/tasks/9', () => HttpResponse.json(taskDetails)),
      http.delete(
        '*/api/tasks/9',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/tasks/9');

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete task' }));

    expect(
      await screen.findByRole('heading', { name: 'Roadmap' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/7');
  });
});
