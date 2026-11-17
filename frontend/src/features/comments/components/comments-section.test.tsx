import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { CommentsSection } from './comments-section';

const comment = (
  id: number,
  authorId: number,
  authorName: string,
  text: string,
) => ({
  id,
  text,
  taskId: 9,
  author: { id: authorId, name: authorName },
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
});

const page = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

const renderSection = (
  props: Partial<{ isProjectOwner: boolean; onChanged: () => void }> = {},
) =>
  renderWithProviders(
    <CommentsSection
      taskId={9}
      currentUserId={1}
      isProjectOwner={false}
      {...props}
    />,
  );

describe('CommentsSection', () => {
  it('shows the empty state of a task without comments', async () => {
    server.use(
      http.get('*/api/tasks/9/comments', () => HttpResponse.json(page([]))),
    );
    renderSection();

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('shows an error with a retry instead of an empty list', async () => {
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Boom' },
          { status: 500 },
        ),
      ),
    );
    renderSection();

    expect(
      await screen.findByText('Could not load comments'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no comments yet/i)).not.toBeInTheDocument();
  });

  it('lets the author edit and delete but offers a stranger nothing', async () => {
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(
          page([comment(1, 1, 'Ann', 'Mine'), comment(2, 2, 'Bob', 'Theirs')]),
        ),
      ),
    );
    renderSection();

    await screen.findByText('Mine');
    expect(
      screen.getByRole('button', { name: 'Edit comment by Ann' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete comment by Ann' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit comment by Bob' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete comment by Bob' }),
    ).not.toBeInTheDocument();
  });

  it('lets the owner of the project delete a comment of someone else, but not edit it', async () => {
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(page([comment(2, 2, 'Bob', 'Theirs')])),
      ),
    );
    renderSection({ isProjectOwner: true });

    await screen.findByText('Theirs');
    expect(
      screen.getByRole('button', { name: 'Delete comment by Bob' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit comment by Bob' }),
    ).not.toBeInTheDocument();
  });

  it('validates and posts a new comment, then reports the change', async () => {
    const onChanged = vi.fn();
    let body: unknown;
    server.use(
      http.get('*/api/tasks/9/comments', () => HttpResponse.json(page([]))),
      http.post('*/api/tasks/9/comments', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(comment(3, 1, 'Ann', 'Hello'), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderSection({ onChanged });

    await screen.findByText(/no comments yet/i);
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(
      await screen.findByText('Write something first'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add a comment'), ' Hello ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(body).toEqual({ text: 'Hello' });
    expect(screen.getByLabelText('Add a comment')).toHaveValue('');
  });

  it('edits a comment in place', async () => {
    let body: unknown;
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(page([comment(1, 1, 'Ann', 'Mine')])),
      ),
      http.patch('*/api/comments/1', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(comment(1, 1, 'Ann', 'Changed'));
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(
      await screen.findByRole('button', { name: 'Edit comment by Ann' }),
    );
    const field = screen.getByLabelText('Edit comment');
    await user.clear(field);
    await user.type(field, 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ text: 'Changed' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument(),
    );
  });

  it('explains why an edit failed and keeps the editor open', async () => {
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(page([comment(1, 1, 'Ann', 'Mine')])),
      ),
      http.patch('*/api/comments/1', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Only the author can edit a comment' },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(
      await screen.findByRole('button', { name: 'Edit comment by Ann' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the author can edit a comment',
    );
    expect(screen.getByLabelText('Edit comment')).toBeInTheDocument();
  });

  it('deletes a comment only after the confirmation', async () => {
    const onChanged = vi.fn();
    let deleted = false;
    server.use(
      http.get('*/api/tasks/9/comments', () =>
        HttpResponse.json(page([comment(1, 1, 'Ann', 'Mine')])),
      ),
      http.delete('*/api/comments/1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderSection({ onChanged });

    await user.click(
      await screen.findByRole('button', { name: 'Delete comment by Ann' }),
    );
    expect(deleted).toBe(false);
    const dialog = screen.getByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete comment' }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(deleted).toBe(true);
  });

  it('reads a long thread by cursor: more comments on request', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get('*/api/tasks/9/comments', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? page([comment(2, 2, 'Bob', 'Second')])
            : page([comment(1, 1, 'Ann', 'First')], 'next-1'),
        );
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('First');
    await user.click(
      screen.getByRole('button', { name: 'Show more comments' }),
    );

    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show more comments' }),
    ).not.toBeInTheDocument();
    expect(cursors).toEqual([null, 'next-1']);
  });

  it('reads on to the end after a comment is posted, so that the new one is visible', async () => {
    let posted = false;
    server.use(
      http.get('*/api/tasks/9/comments', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor) {
          return HttpResponse.json(
            page(
              posted
                ? [
                    comment(2, 2, 'Bob', 'Second'),
                    comment(3, 1, 'Ann', 'Newest'),
                  ]
                : [comment(2, 2, 'Bob', 'Second')],
            ),
          );
        }
        return HttpResponse.json(
          page([comment(1, 1, 'Ann', 'First')], 'next-1'),
        );
      }),
      http.post('*/api/tasks/9/comments', () => {
        posted = true;
        return HttpResponse.json(comment(3, 1, 'Ann', 'Newest'), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('First');
    await user.type(screen.getByLabelText('Add a comment'), 'Newest');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Newest')).toBeInTheDocument();
  });
});
