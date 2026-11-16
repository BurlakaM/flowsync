import type { QueryKey } from '@tanstack/react-query';
import { activityKeys } from '@/features/activity';
import { commentsKeys } from '@/features/comments';
import { notificationsKeys } from '@/features/notifications';
import { projectsKeys } from '@/features/projects';
import { tasksKeys } from '@/features/tasks';
import type { RealtimeEvent } from '@/lib/realtime';

/**
 * Which cached data an event makes stale. Features do not know about each other, so the app, which
 * knows them all, decides: a new task also changes the task counter on the project, and everything
 * ends up in the project's activity.
 */
export function queryKeysFor(event: RealtimeEvent): QueryKey[] {
  const keys: QueryKey[] = [activityKeys.all];

  switch (event.entityType) {
    case 'Project':
    case 'Member':
      keys.push(projectsKeys.all, notificationsKeys.all);
      break;
    case 'Task':
      keys.push(tasksKeys.all, projectsKeys.all);
      break;
    case 'Comment':
      // The comment counter on the task changes as well.
      keys.push(commentsKeys.all, tasksKeys.all);
      break;
    case 'Tag':
      keys.push(tasksKeys.all);
      break;
  }
  return keys;
}
