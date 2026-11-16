import i18n from '@/i18n';
import { tKey } from '@/i18n/t-key';
import type { Activity } from '../types';

const STATUS_LABELS: Record<string, string> = {
  TODO: tKey('To do'),
  IN_PROGRESS: tKey('In progress'),
  DONE: tKey('Done'),
};

const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : i18n.t('unnamed');

const quoted = (value: unknown) => `“${text(value)}”`;
const t = (key: string, values: Record<string, unknown> = {}) =>
  i18n.t(key, values);

/** A sentence about what happened, without the name of the person: "created the task “Fix login”". */
export function describeActivity(activity: Activity): string {
  const { data } = activity;

  switch (activity.type) {
    case 'project.created':
      return t('created the project {{name}}', { name: quoted(data.name) });
    case 'project.updated':
      if (data.image === 'changed') {
        return t('changed the picture of the project {{name}}', {
          name: quoted(data.name),
        });
      }
      if (data.image === 'removed') {
        return t('removed the picture of the project {{name}}', {
          name: quoted(data.name),
        });
      }
      return typeof data.renamedFrom === 'string'
        ? t('renamed the project from {{from}} to {{to}}', {
            from: quoted(data.renamedFrom),
            to: quoted(data.name),
          })
        : t('updated the project {{name}}', { name: quoted(data.name) });
    case 'project.deleted':
      return t('deleted the project');
    case 'member.added':
      return t('added {{name}} to the project', { name: text(data.name) });
    case 'member.removed':
      return t('removed {{name}} from the project', {
        name: text(data.name),
      });
    case 'task.created':
      return t('created the task {{name}}', { name: quoted(data.name) });
    case 'task.updated': {
      const status = data.status as { from?: string; to?: string } | undefined;
      if (status?.from && status.to) {
        const from = STATUS_LABELS[status.from]
          ? t(STATUS_LABELS[status.from])
          : status.from;
        const to = STATUS_LABELS[status.to]
          ? t(STATUS_LABELS[status.to])
          : status.to;
        return t('moved {{name}} from {{from}} to {{to}}', {
          name: quoted(data.name),
          from,
          to,
        });
      }
      return t('updated the task {{name}}', { name: quoted(data.name) });
    }
    case 'task.deleted':
      return t('deleted the task {{name}}', { name: quoted(data.name) });
    case 'comment.created':
      return typeof data.excerpt === 'string'
        ? t('commented on {{task}}: {{excerpt}}', {
            task: quoted(data.taskName),
            excerpt: quoted(data.excerpt),
          })
        : t('commented on {{task}}', { task: quoted(data.taskName) });
    case 'comment.updated':
      return t('edited a comment on {{task}}', { task: quoted(data.taskName) });
    case 'comment.deleted':
      return t('deleted a comment on {{task}}', {
        task: quoted(data.taskName),
      });
    case 'tag.created':
      return t('created the tag {{name}}', { name: quoted(data.name) });
    case 'tag.updated':
      return typeof data.renamedFrom === 'string'
        ? t('renamed the tag {{from}} to {{to}}', {
            from: quoted(data.renamedFrom),
            to: quoted(data.name),
          })
        : t('updated the tag {{name}}', { name: quoted(data.name) });
    case 'tag.deleted':
      return t('deleted the tag {{name}}', { name: quoted(data.name) });
    default:
      // A newer API may know more events than this client: show something instead of nothing.
      return t('did something ({{type}})', { type: activity.type });
  }
}
