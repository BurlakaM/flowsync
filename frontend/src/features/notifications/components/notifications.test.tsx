import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { NotificationsLink } from './notifications-link';
import { NotificationsList } from './notifications-list';

const item = (id: number, readAt: string | null, taskName = `Task ${id}`) => ({
  id,
  type: 'task.assigned',
  data: { actorName: 'Ann', taskId: id, taskName },
  readAt,
  createdAt: '2026-01-01T10:00:00.000Z',
});

const page = (items: unknown[], pageNumber = 1, totalPages = 1) => ({
  items,
  meta: { page: pageNumber, limit: 20, total: items.length, totalPages },
});

describe('NotificationsLink', () => {
  it('shows no number when everything is read', async () => {
    renderWithProviders(<NotificationsLink />);

    expect(
      await screen.findByRole('link', { name: 'Notifications' }),
    ).toHaveAttribute('href', '/notifications');
  });

  it('announces the number of unread notifications', async () => {
    server.use(
      http.get('*/api/notifications/unread-count', () =>
        HttpResponse.json({ count: 3 }),
      ),
    );
    renderWithProviders(<NotificationsLink />);

    expect(
      await screen.findByRole('link', { name: 'Notifications, unread: 3' }),
    ).toBeInTheDocument();
  });

  it('keeps working when the count cannot be loaded', async () => {
    server.use(
      http.get('*/api/notifications/unread-count', () =>
        HttpResponse.json({ statusCode: 500 }, { status: 500 }),
      ),
    );
    renderWithProviders(<NotificationsLink />);

    expect(
      await screen.findByRole('link', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });
});

describe('NotificationsList', () => {
  it('lists notifications with links and marks the unread ones', async () => {
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(
          page([
            item(1, null, 'Fix login'),
            item(2, '2026-01-02T00:00:00.000Z'),
          ]),
        ),
      ),
    );
    renderWithProviders(<NotificationsList />);

    const link = await screen.findByRole('link', {
      name: 'Ann assigned you to “Fix login”',
    });
    expect(link).toHaveAttribute('href', '/tasks/1');
    // Only the unread one offers "mark as read".
    expect(
      screen.getAllByRole('button', { name: /^Mark as read:/ }),
    ).toHaveLength(1);
  });

  it('says so when there is nothing', async () => {
    server.use(
      http.get('*/api/notifications', () => HttpResponse.json(page([]))),
    );
    renderWithProviders(<NotificationsList />);

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('shows an error with a retry instead of an empty list', async () => {
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Boom' },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<NotificationsList />);

    expect(
      await screen.findByText('Could not load notifications'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });

  it('marks one notification as read', async () => {
    let marked = '';
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(page([item(5, null)])),
      ),
      http.post('*/api/notifications/:id/read', ({ params }) => {
        marked = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsList />);

    await user.click(
      await screen.findByRole('button', { name: /^Mark as read:/ }),
    );

    await waitFor(() => expect(marked).toBe('5'));
  });

  it('marks everything as read, only while something is unread', async () => {
    let called = false;
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(page([item(5, null)])),
      ),
      http.get('*/api/notifications/unread-count', () =>
        HttpResponse.json({ count: 1 }),
      ),
      http.post('*/api/notifications/read-all', () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsList />);

    const button = await screen.findByRole('button', {
      name: 'Mark all as read',
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(called).toBe(true));
  });

  it('disables "mark all" when nothing is unread', async () => {
    server.use(
      http.get('*/api/notifications', () => HttpResponse.json(page([]))),
    );
    renderWithProviders(<NotificationsList />);

    expect(
      await screen.findByRole('button', { name: 'Mark all as read' }),
    ).toBeDisabled();
  });

  it('asks only for unread notifications when filtered', async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get('*/api/notifications', ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('unread'));
        return HttpResponse.json(page([]));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsList />);

    await screen.findByText('No notifications yet');
    await user.click(screen.getByRole('button', { name: 'Unread' }));

    expect(
      await screen.findByText('No unread notifications'),
    ).toBeInTheDocument();
    expect(queries).toEqual([null, 'true']);
  });

  it('explains why marking failed', async () => {
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(page([item(5, null)])),
      ),
      http.post('*/api/notifications/:id/read', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Notification not found' },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsList />);

    await user.click(
      await screen.findByRole('button', { name: /^Mark as read:/ }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notification not found',
    );
  });
});
