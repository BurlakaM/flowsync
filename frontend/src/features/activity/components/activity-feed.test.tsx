import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { ActivityFeed } from './activity-feed';

const entry = (
  id: number,
  actor: string | null,
  type: string,
  name: string,
) => ({
  id,
  type,
  entityType: 'Task',
  entityId: id,
  data: { name },
  actor: actor ? { id: 1, name: actor } : null,
  createdAt: '2026-01-01T10:00:00.000Z',
});

const page = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

describe('ActivityFeed', () => {
  it('lists who did what', async () => {
    server.use(
      http.get('*/api/projects/7/activity', () =>
        HttpResponse.json(
          page([
            entry(2, 'Bob', 'task.deleted', 'Old task'),
            entry(1, null, 'task.created', 'Old task'),
          ]),
        ),
      ),
    );
    renderWithProviders(<ActivityFeed projectId={7} />);

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/deleted the task “Old task”/)).toBeInTheDocument();
    // The account of the author is gone: the entry stays.
    expect(screen.getByText('Someone')).toBeInTheDocument();
  });

  it('says so when nothing has happened', async () => {
    server.use(
      http.get('*/api/projects/7/activity', () => HttpResponse.json(page([]))),
    );
    renderWithProviders(<ActivityFeed projectId={7} />);

    expect(
      await screen.findByText('Nothing happened yet.'),
    ).toBeInTheDocument();
  });

  it('shows an error with a retry instead of an empty feed', async () => {
    server.use(
      http.get('*/api/projects/7/activity', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Boom' },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<ActivityFeed projectId={7} />);

    expect(
      await screen.findByText('Could not load the activity'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nothing happened yet.')).not.toBeInTheDocument();
  });

  it('shows older entries on request, asking for them by cursor', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get('*/api/projects/7/activity', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? page([entry(1, 'Ann', 'task.created', 'Task old')])
            : page([entry(2, 'Ann', 'task.created', 'Task new')], 'abc'),
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ActivityFeed projectId={7} />);

    await screen.findByText(/Task new/);
    expect(screen.queryByText(/Task old/)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Show older activity' }),
    );

    expect(await screen.findByText(/Task old/)).toBeInTheDocument();
    // Both entries stay on screen and the button is gone: that was the last page.
    expect(screen.getByText(/Task new/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show older activity' }),
    ).not.toBeInTheDocument();
    expect(cursors).toEqual([null, 'abc']);
  });

  it('offers no "older" button when everything fits on one page', async () => {
    server.use(
      http.get('*/api/projects/7/activity', () =>
        HttpResponse.json(page([entry(1, 'Ann', 'task.created', 'Only')])),
      ),
    );
    renderWithProviders(<ActivityFeed projectId={7} />);

    await screen.findByText(/Only/);
    expect(
      screen.queryByRole('button', { name: 'Show older activity' }),
    ).not.toBeInTheDocument();
  });
});
