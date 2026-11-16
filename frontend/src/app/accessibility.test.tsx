import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { expectNoA11yViolations } from '@/testing/a11y';
import { server } from '@/testing/mocks/server';
import { renderApp } from '@/testing/test-utils';

const ann = {
  id: 1,
  name: 'Ann',
  email: 'ann@example.test',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
};
const stamp = '2026-01-01T00:00:00.000Z';

const project = {
  id: 7,
  name: 'Roadmap',
  description: 'Plans for the year',
  image: null,
  ownerId: 1,
  myRole: 'OWNER',
  tasksCount: 1,
  createdAt: stamp,
  updatedAt: stamp,
};
const task = {
  id: 9,
  name: 'Fix login',
  description: 'It fails on Safari',
  status: 'IN_PROGRESS',
  projectId: 7,
  createdById: 1,
  assignees: [{ id: 2, name: 'Bob' }],
  tags: [{ id: 5, name: 'bug' }],
  commentsCount: 1,
  createdAt: stamp,
  updatedAt: stamp,
};
const page = (items: unknown[]) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
});

beforeEach(() => {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json(ann)),
    http.get('*/api/projects', () => HttpResponse.json(page([project]))),
    http.get('*/api/projects/7', () =>
      HttpResponse.json({
        ...project,
        owner: { id: 1, name: 'Ann' },
        members: [
          {
            userId: 1,
            name: 'Ann',
            email: 'ann@example.test',
            role: 'OWNER',
            joinedAt: stamp,
          },
          {
            userId: 2,
            name: 'Bob',
            email: 'bob@example.test',
            role: 'MEMBER',
            joinedAt: stamp,
          },
        ],
      }),
    ),
    http.get('*/api/projects/7/tags', () =>
      HttpResponse.json([
        { id: 5, name: 'bug', projectId: 7, createdAt: stamp },
      ]),
    ),
    http.get('*/api/projects/7/tasks', () => HttpResponse.json(page([task]))),
    http.get('*/api/tasks/9', () =>
      HttpResponse.json({
        ...task,
        project: { id: 7, name: 'Roadmap' },
        createdBy: { id: 1, name: 'Ann' },
      }),
    ),
    http.get('*/api/tasks/9/comments', () =>
      HttpResponse.json(
        page([
          {
            id: 1,
            text: 'Looks reproducible',
            taskId: 9,
            author: { id: 2, name: 'Bob' },
            createdAt: stamp,
            updatedAt: stamp,
          },
        ]),
      ),
    ),
  );
});

describe('accessibility (axe)', () => {
  it('the sign-in page has no violations', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { name: /sign in to flowsync/i });

    await expectNoA11yViolations();
  });

  it('the sign-up page has no violations', async () => {
    renderApp('/register');
    await screen.findByRole('heading', { name: /create your account/i });

    await expectNoA11yViolations();
  });

  describe('signed in', () => {
    beforeEach(() => authStorage.setToken('jwt-token'));

    it('the projects page has no violations', async () => {
      renderApp('/projects');
      await screen.findByRole('link', { name: 'Roadmap' });

      await expectNoA11yViolations();
    });

    it('the project page has no violations', async () => {
      renderApp('/projects/7');
      await screen.findByRole('link', { name: 'Fix login' });
      await screen.findByRole('button', { name: 'Delete tag bug' });

      await expectNoA11yViolations();
    });

    it('the task page has no violations', async () => {
      renderApp('/tasks/9');
      await screen.findByText('Looks reproducible');

      await expectNoA11yViolations();
    });

    it('the new task dialog has no violations', async () => {
      const user = userEvent.setup();
      renderApp('/projects/7');
      await screen.findByRole('link', { name: 'Fix login' });

      await user.click(screen.getAllByRole('button', { name: 'New task' })[0]);
      await screen.findByRole('dialog');

      await expectNoA11yViolations();
    });

    it('the delete confirmation has no violations', async () => {
      const user = userEvent.setup();
      renderApp('/tasks/9');
      await screen.findByText('Looks reproducible');

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await screen.findByRole('alertdialog');

      await expectNoA11yViolations();
    });
  });
});
