import type { Notification } from '../types';
import { describeNotification } from './describe-notification';

const notification = (
  type: string,
  data: Record<string, unknown>,
): Notification => ({
  id: 1,
  type,
  data,
  readAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('describeNotification', () => {
  it('links an assignment to the task', () => {
    expect(
      describeNotification(
        notification('task.assigned', {
          actorName: 'Ann',
          taskId: 9,
          taskName: 'Fix login',
        }),
      ),
    ).toEqual({ text: 'Ann assigned you to “Fix login”', to: '/tasks/9' });
  });

  it('quotes the comment and links to the task', () => {
    expect(
      describeNotification(
        notification('comment.added', {
          actorName: 'Bob',
          taskId: 9,
          taskName: 'Fix login',
          excerpt: 'Looks good',
        }),
      ),
    ).toEqual({
      text: 'Bob commented on “Fix login”: “Looks good”',
      to: '/tasks/9',
    });
  });

  it('links an invitation to the project', () => {
    expect(
      describeNotification(
        notification('project.invited', {
          actorName: 'Ann',
          projectId: 7,
          projectName: 'Roadmap',
        }),
      ),
    ).toEqual({ text: 'Ann added you to “Roadmap”', to: '/projects/7' });
  });

  it('survives missing data and unknown types without a link', () => {
    expect(describeNotification(notification('task.assigned', {}))).toEqual({
      text: 'Someone assigned you to “a task”',
      to: null,
    });
    expect(
      describeNotification(
        notification('sprint.started', { actorName: 'Ann' }),
      ),
    ).toEqual({ text: 'Ann did something (sprint.started)', to: null });
  });
});
