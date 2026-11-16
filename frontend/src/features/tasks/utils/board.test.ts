import type { Task } from '../types';
import { getDropStatus, groupByStatus } from './board';

const task = (id: number, status: Task['status']): Task => ({
  id,
  name: `Task ${id}`,
  description: null,
  status,
  projectId: 1,
  createdById: 1,
  assignees: [],
  tags: [],
  commentsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('groupByStatus', () => {
  it('always returns the three columns, keeping the order of the tasks', () => {
    expect(groupByStatus([])).toEqual({ TODO: [], IN_PROGRESS: [], DONE: [] });

    const grouped = groupByStatus([
      task(1, 'DONE'),
      task(2, 'TODO'),
      task(3, 'DONE'),
    ]);

    expect(grouped.DONE.map((item) => item.id)).toEqual([1, 3]);
    expect(grouped.TODO.map((item) => item.id)).toEqual([2]);
    expect(grouped.IN_PROGRESS).toEqual([]);
  });
});

describe('getDropStatus', () => {
  it('returns the status of another column', () => {
    expect(getDropStatus('TODO', 'DONE')).toBe('DONE');
  });

  it('returns null for the same column, no target or an unknown target', () => {
    expect(getDropStatus('TODO', 'TODO')).toBeNull();
    expect(getDropStatus('TODO', undefined)).toBeNull();
    expect(getDropStatus('TODO', 'ARCHIVED')).toBeNull();
    expect(getDropStatus('TODO', 42)).toBeNull();
  });
});
