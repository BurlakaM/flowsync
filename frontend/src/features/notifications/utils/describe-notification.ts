import i18n from '@/i18n';
import type { Notification } from '../types';

export interface NotificationView {
  /** The sentence, starting with the name of the person who caused it. */
  text: string;
  /** Where the notification leads, or null when the target is unknown. */
  to: string | null;
}

const str = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.length > 0 ? value : fallback;
const id = (value: unknown) => (typeof value === 'number' ? value : null);
const t = (key: string, values: Record<string, unknown> = {}) =>
  i18n.t(key, values);

export function describeNotification(
  notification: Notification,
): NotificationView {
  const { data } = notification;
  const actor = str(data.actorName, t('Someone'));
  const task = `“${str(data.taskName, t('a task'))}”`;
  const taskId = id(data.taskId);
  const projectId = id(data.projectId);

  switch (notification.type) {
    case 'task.assigned':
      return {
        text: t('{{actor}} assigned you to {{task}}', { actor, task }),
        to: taskId ? `/tasks/${taskId}` : null,
      };
    case 'comment.added': {
      const excerpt = str(data.excerpt, '');
      return {
        text: excerpt
          ? t('{{actor}} commented on {{task}}: {{excerpt}}', {
              actor,
              task,
              excerpt: `“${excerpt}”`,
            })
          : t('{{actor}} commented on {{task}}', { actor, task }),
        to: taskId ? `/tasks/${taskId}` : null,
      };
    }
    case 'project.invited':
      return {
        text: t('{{actor}} added you to {{project}}', {
          actor,
          project: `“${str(data.projectName, t('a project'))}”`,
        }),
        to: projectId ? `/projects/${projectId}` : null,
      };
    default:
      // A newer API may send types this client does not know yet.
      return {
        text: t('{{actor}} did something ({{type}})', {
          actor,
          type: notification.type,
        }),
        to: null,
      };
  }
}
