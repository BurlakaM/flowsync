import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { useProjectTasks } from '../api/get-tasks';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { Task, TaskFilters } from '../types';
import { TaskBoard } from './task-board';

const task = (id: number, name: string, status: Task['status']): Task => ({
  id,
  name,
  description: null,
  status,
  projectId: 7,
  createdById: 1,
  assignees: [{ id: 2, name: 'Bob' }],
  tags: [{ id: 5, name: 'bug' }],
  commentsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const filters: TaskFilters = { sortBy: 'createdAt', order: 'desc', page: 1 };

/** The board fed by the real query, so the optimistic update of the cache is visible. */
function ConnectedBoard() {
  const tasks = useProjectTasks(7, filters, 100);
  return tasks.data ? <TaskBoard tasks={tasks.data.items} /> : null;
}

function renderBoard(queryClient: QueryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConnectedBoard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const page = (items: Task[]) => ({
  items,
  meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
});

const column = (name: string) =>
  screen.getByRole('region', { name: new RegExp(name) });

describe('TaskBoard', () => {
  it('puts every task in the column of its status and counts them', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(
          page([
            task(1, 'Write docs', 'TODO'),
            task(2, 'Fix login', 'IN_PROGRESS'),
            task(3, 'Plan sprint', 'TODO'),
          ]),
        ),
      ),
    );
    renderBoard();

    await screen.findByText('Write docs');
    expect(
      within(column('To do')).getByRole('link', { name: 'Write docs' }),
    ).toBeInTheDocument();
    expect(
      within(column('To do')).getByRole('link', { name: 'Plan sprint' }),
    ).toBeInTheDocument();
    expect(
      within(column('In progress')).getByRole('link', { name: 'Fix login' }),
    ).toBeInTheDocument();
    expect(within(column('Done')).getByText('No tasks here.')).toBeVisible();
  });

  it('gives every card a drag handle with a name', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(page([task(1, 'Write docs', 'TODO')])),
      ),
    );
    renderBoard();

    expect(
      await screen.findByRole('button', { name: 'Move Write docs' }),
    ).toBeInTheDocument();
  });

  it('moves a card at once when the status is changed and keeps it after the API confirms', async () => {
    let body: unknown;
    let stored: Task['status'] = 'TODO';
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(page([task(1, 'Write docs', stored)])),
      ),
      http.patch('*/api/tasks/1', async ({ request }) => {
        body = await request.json();
        stored = 'DONE';
        return HttpResponse.json(task(1, 'Write docs', 'DONE'));
      }),
    );
    const user = userEvent.setup();
    renderBoard();

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Status of Write docs' }),
      'DONE',
    );

    await waitFor(() =>
      expect(
        within(column('Done')).getByRole('link', { name: 'Write docs' }),
      ).toBeInTheDocument(),
    );
    expect(body).toEqual({ status: 'DONE' });
  });
});

describe('moving a task with the mutation used by dragging', () => {
  it('returns the card to its column and explains when the API refuses', async () => {
    server.use(
      http.get('*/api/projects/7/tasks', () =>
        HttpResponse.json(page([task(1, 'Write docs', 'TODO')])),
      ),
      http.patch('*/api/tasks/1', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Not allowed' },
          { status: 403 },
        ),
      ),
    );
    const { useMoveTask } = await import('../api/task-mutations');
    const queryClient = createTestQueryClient();

    function Probe() {
      const tasks = useProjectTasks(7, filters, 100);
      const move = useMoveTask();
      return (
        <>
          <button onClick={() => move.mutate({ id: 1, status: 'DONE' })}>
            Drop
          </button>
          <p data-testid="status">{tasks.data?.items[0]?.status}</p>
          {move.isError && <p role="alert">refused</p>}
        </>
      );
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('TODO'),
    );
    await user.click(screen.getByRole('button', { name: 'Drop' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('refused');
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('TODO'),
    );
  });
});
