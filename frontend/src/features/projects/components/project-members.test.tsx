import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { ProjectDetails } from '../types';
import { ProjectMembers } from './project-members';

const details = (myRole: 'OWNER' | 'MEMBER'): ProjectDetails => ({
  id: 7,
  name: 'Roadmap',
  description: null,
  hasImage: false,
  ownerId: 1,
  myRole,
  tasksCount: 0,
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

describe('ProjectMembers', () => {
  it('lets the owner add a member by email', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/projects/7/members', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectMembers project={details('OWNER')} />);

    await user.type(
      screen.getByLabelText('Add a member by email'),
      'cat@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(body).toEqual({ email: 'cat@example.test' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Add a member by email')).toHaveValue(''),
    );
  });

  it('shows why a member could not be added', async () => {
    server.use(
      http.post('*/api/projects/7/members', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'User not found' },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectMembers project={details('OWNER')} />);

    await user.type(
      screen.getByLabelText('Add a member by email'),
      'nobody@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User not found',
    );
  });

  it('lets the owner remove a member but never the owner', async () => {
    let removed = '';
    server.use(
      http.delete('*/api/projects/7/members/:userId', ({ params }) => {
        removed = String(params.userId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectMembers project={details('OWNER')} />);

    expect(
      screen.queryByRole('button', { name: 'Remove Ann' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Bob' }));

    await waitFor(() => expect(removed).toBe('2'));
  });

  it('is read-only for a plain member', () => {
    renderWithProviders(<ProjectMembers project={details('MEMBER')} />);

    expect(screen.getByText('bob@example.test')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Add a member by email'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /remove/i }),
    ).not.toBeInTheDocument();
  });
});
