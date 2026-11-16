import { buildEmail, type NotificationData } from './notification-content';

const data: NotificationData = {
  actorName: 'Ann',
  projectId: 7,
  projectName: 'Roadmap',
  taskId: 9,
  taskName: 'Fix login',
  excerpt: 'Looks good',
};

describe('buildEmail', () => {
  it('tells who assigned the task and links to it', () => {
    const email = buildEmail('task.assigned', data, 'https://app.example');

    expect(email.subject).toBe('Ann assigned you to “Fix login”');
    expect(email.text).toContain('https://app.example/tasks/9');
    expect(email.text).toContain('Roadmap');
  });

  it('quotes the comment and links to the task', () => {
    const email = buildEmail('comment.added', data, 'https://app.example');

    expect(email.subject).toBe('New comment on “Fix login”');
    expect(email.text).toContain('Ann commented');
    expect(email.text).toContain('Looks good');
    expect(email.text).toContain('https://app.example/tasks/9');
  });

  it('links to the project when someone is added to it', () => {
    const email = buildEmail('project.invited', data, 'https://app.example');

    expect(email.subject).toBe('Ann added you to “Roadmap”');
    expect(email.text).toContain('https://app.example/projects/7');
  });
});
