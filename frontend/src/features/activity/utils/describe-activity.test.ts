import type { Activity } from '../types';
import { describeActivity } from './describe-activity';

const entry = (type: string, data: Record<string, unknown> = {}): Activity => ({
  id: 1,
  type,
  entityType: 'Task',
  entityId: 1,
  data,
  actor: { id: 1, name: 'Ann' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('describeActivity', () => {
  it.each([
    ['project.created', { name: 'Roadmap' }, 'created the project “Roadmap”'],
    ['project.deleted', {}, 'deleted the project'],
    ['member.added', { name: 'Bob' }, 'added Bob to the project'],
    ['member.removed', { name: 'Bob' }, 'removed Bob from the project'],
    ['task.created', { name: 'Fix login' }, 'created the task “Fix login”'],
    ['task.deleted', { name: 'Fix login' }, 'deleted the task “Fix login”'],
    ['comment.deleted', { taskName: 'Fix' }, 'deleted a comment on “Fix”'],
    ['tag.created', { name: 'bug' }, 'created the tag “bug”'],
    ['tag.deleted', { name: 'bug' }, 'deleted the tag “bug”'],
  ])('describes %s', (type, data, expected) => {
    expect(describeActivity(entry(type, data))).toBe(expected);
  });

  it('says where a task moved when its status changed', () => {
    expect(
      describeActivity(
        entry('task.updated', {
          name: 'Fix',
          status: { from: 'TODO', to: 'IN_PROGRESS' },
        }),
      ),
    ).toBe('moved “Fix” from To do to In progress');
  });

  it('describes other task updates generally', () => {
    expect(describeActivity(entry('task.updated', { name: 'Fix' }))).toBe(
      'updated the task “Fix”',
    );
  });

  it('shows renames and the excerpt of a comment', () => {
    expect(
      describeActivity(
        entry('project.updated', { name: 'New', renamedFrom: 'Old' }),
      ),
    ).toBe('renamed the project from “Old” to “New”');
    expect(
      describeActivity(
        entry('tag.updated', { name: 'new', renamedFrom: 'old' }),
      ),
    ).toBe('renamed the tag “old” to “new”');
    expect(
      describeActivity(
        entry('comment.created', { taskName: 'Fix', excerpt: 'Looks good' }),
      ),
    ).toBe('commented on “Fix”: “Looks good”');
  });

  it('survives missing data and unknown events', () => {
    expect(describeActivity(entry('task.created'))).toBe(
      'created the task “unnamed”',
    );
    expect(describeActivity(entry('sprint.started'))).toBe(
      'did something (sprint.started)',
    );
  });
});

describe('describeActivity: picture of a project', () => {
  it('tells that the picture changed or was removed', () => {
    expect(
      describeActivity(
        entry('project.updated', { name: 'Roadmap', image: 'changed' }),
      ),
    ).toBe('changed the picture of the project “Roadmap”');
    expect(
      describeActivity(
        entry('project.updated', { name: 'Roadmap', image: 'removed' }),
      ),
    ).toBe('removed the picture of the project “Roadmap”');
  });
});
