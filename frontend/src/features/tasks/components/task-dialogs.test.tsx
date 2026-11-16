import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { Tag, Task } from '../types';
import { DeleteTaskDialog } from './delete-task-dialog';
import { StatusSelect } from './status-select';
import { TaskFormDialog } from './task-form-dialog';

const task: Task = {
  id: 9,
  name: 'Fix login',
  description: 'It fails',
  status: 'IN_PROGRESS',
  projectId: 7,
  createdById: 1,
  assignees: [{ id: 2, name: 'Bob' }],
  tags: [{ id: 5, name: 'bug' }],
  commentsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const assignees = [
  { id: 1, name: 'Ann' },
  { id: 2, name: 'Bob' },
];
const tags: Tag[] = [
  { id: 5, name: 'bug', projectId: 7, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 6, name: 'ui', projectId: 7, createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('TaskFormDialog', () => {
  it('validates the name before sending anything', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        projectId={7}
        assignees={assignees}
        tags={tags}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
  });

  it('creates a task with the chosen status, assignees and tags', async () => {
    const onSaved = vi.fn();
    let body: unknown;
    server.use(
      http.post('*/api/projects/7/tasks', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { ...task, project: { id: 7, name: 'Roadmap' }, createdBy: null },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        projectId={7}
        assignees={assignees}
        tags={tags}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Fix login');
    await user.selectOptions(screen.getByLabelText('Status'), 'DONE');
    await user.click(screen.getByRole('checkbox', { name: 'Ann' }));
    await user.click(screen.getByRole('checkbox', { name: 'ui' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(body).toEqual({
      name: 'Fix login',
      description: '',
      status: 'DONE',
      assigneeIds: [1],
      tagIds: [6],
    });
  });

  it('starts from the current values when editing and sends the changes with PATCH', async () => {
    let body: unknown;
    server.use(
      http.patch('*/api/tasks/9', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          ...task,
          project: { id: 7, name: 'Roadmap' },
          createdBy: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        projectId={7}
        task={task}
        assignees={assignees}
        tags={tags}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('Fix login');
    expect(screen.getByLabelText('Status')).toHaveValue('IN_PROGRESS');
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ann' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(body).toEqual({
        name: 'Fix login',
        description: 'It fails',
        status: 'IN_PROGRESS',
        assigneeIds: [],
        tagIds: [5],
      }),
    );
  });

  it('keeps an assignee who is no longer offered and explains server errors', async () => {
    server.use(
      http.patch('*/api/tasks/9', () =>
        HttpResponse.json(
          { statusCode: 400, message: ['assigneeIds must be members'] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        projectId={7}
        task={task}
        assignees={[]}
        tags={[]}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'assigneeIds must be members',
    );
  });
});

describe('StatusSelect', () => {
  it('sends only the status when it changes', async () => {
    const onChanged = vi.fn();
    let body: unknown;
    server.use(
      http.patch('*/api/tasks/9', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...task, status: 'DONE' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <StatusSelect
        taskId={9}
        taskName="Fix login"
        status="IN_PROGRESS"
        onChanged={onChanged}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status of Fix login' }),
      'DONE',
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(body).toEqual({ status: 'DONE' });
  });

  it('shows why the change failed', async () => {
    server.use(
      http.patch('*/api/tasks/9', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Task not found' },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <StatusSelect taskId={9} taskName="Fix login" status="TODO" />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status of Fix login' }),
      'DONE',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Task not found',
    );
  });
});

describe('DeleteTaskDialog', () => {
  it('deletes only after the confirmation', async () => {
    const onDeleted = vi.fn();
    let deleted = false;
    server.use(
      http.delete('*/api/tasks/9', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteTaskDialog
        task={task}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    expect(deleted).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Delete task' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleted).toBe(true);
  });

  it('explains a refusal and stays open', async () => {
    const onDeleted = vi.fn();
    server.use(
      http.delete('*/api/tasks/9', () =>
        HttpResponse.json(
          {
            statusCode: 403,
            message: 'Only the author or the owner can delete',
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteTaskDialog
        task={task}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the author or the owner can delete',
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
