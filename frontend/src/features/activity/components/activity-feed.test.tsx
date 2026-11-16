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

const page = (items: unknown[], pageNumber = 1, totalPages = 1) => ({
  items,
  meta: { page: pageNumber, limit: 15, total: items.length, totalPages },
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

  it('pages through older entries', async () => {
    const pages: string[] = [];
    server.use(
      http.get('*/api/projects/7/activity', ({ request }) => {
        const pageNumber = new URL(request.url).searchParams.get('page') ?? '1';
        pages.push(pageNumber);
        return HttpResponse.json(
          page(
            [
              entry(
                Number(pageNumber),
                'Ann',
                'task.created',
                `Task ${pageNumber}`,
              ),
            ],
            Number(pageNumber),
            2,
          ),
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ActivityFeed projectId={7} />);

    await screen.findByText(/Task 1/);
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText(/Task 2/)).toBeInTheDocument();
    expect(pages).toEqual(['1', '2']);
  });
});
