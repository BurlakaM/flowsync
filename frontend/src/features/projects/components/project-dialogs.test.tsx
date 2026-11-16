import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { Project } from '../types';
import { DeleteProjectDialog } from './delete-project-dialog';
import { ProjectFormDialog } from './project-form-dialog';

const project: Project = {
  id: 7,
  name: 'Roadmap',
  description: 'Plans',
  hasImage: false,
  ownerId: 1,
  myRole: 'OWNER',
  tasksCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProjectFormDialog', () => {
  it('validates the name before sending anything', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectFormDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
  });

  it('creates a project and reports it', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    let body: unknown;
    server.use(
      http.post('*/api/projects', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(project, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectFormDialog open onOpenChange={onOpenChange} onSaved={onSaved} />,
    );

    await user.type(screen.getByLabelText('Name'), '  Roadmap ');
    await user.type(screen.getByLabelText('Description'), 'Plans');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toEqual(project);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(body).toEqual({ name: 'Roadmap', description: 'Plans' });
  });

  it('starts from the current values when editing and saves with PATCH', async () => {
    let body: unknown;
    server.use(
      http.patch('*/api/projects/7', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...project, name: 'Renamed' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectFormDialog open onOpenChange={vi.fn()} project={project} />,
    );

    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Roadmap');
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(body).toEqual({ name: 'Renamed', description: 'Plans' }),
    );
  });

  it('shows the message of the API and stays open on a server error', async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.patch('*/api/projects/7', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Only the owner can do this' },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectFormDialog open onOpenChange={onOpenChange} project={project} />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the owner can do this',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('DeleteProjectDialog', () => {
  it('asks first and deletes only after the confirmation', async () => {
    const onDeleted = vi.fn();
    let deleted = false;
    server.use(
      http.delete('*/api/projects/7', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteProjectDialog
        project={project}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Roadmap');
    expect(deleted).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Delete project' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleted).toBe(true);
  });

  it('keeps the dialog open and explains a failure', async () => {
    const onDeleted = vi.fn();
    server.use(
      http.delete('*/api/projects/7', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Project not found' },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteProjectDialog
        project={project}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Project not found',
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
