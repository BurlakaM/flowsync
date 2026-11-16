export type NotificationType =
  'task.assigned' | 'comment.added' | 'project.invited';

/** Facts stored with a notification: enough for the client to write the sentence and link to the target. */
export interface NotificationData {
  actorName: string;
  projectId: number;
  projectName: string;
  taskId?: number;
  taskName?: string;
  excerpt?: string;
}

export interface EmailContent {
  subject: string;
  text: string;
}

/** The email for a notification: plain text with one link back into the application. */
export function buildEmail(
  type: NotificationType,
  data: NotificationData,
  appUrl: string,
): EmailContent {
  const task = `“${data.taskName ?? 'a task'}”`;
  const project = `“${data.projectName}”`;
  const taskLink = `${appUrl}/tasks/${data.taskId}`;
  const projectLink = `${appUrl}/projects/${data.projectId}`;

  switch (type) {
    case 'task.assigned':
      return {
        subject: `${data.actorName} assigned you to ${task}`,
        text: `${data.actorName} assigned you to the task ${task} in the project ${project}.\n\nOpen it: ${taskLink}\n`,
      };
    case 'comment.added':
      return {
        subject: `New comment on ${task}`,
        text: `${data.actorName} commented on ${task} in the project ${project}:\n\n${data.excerpt ?? ''}\n\nOpen the task: ${taskLink}\n`,
      };
    case 'project.invited':
      return {
        subject: `${data.actorName} added you to ${project}`,
        text: `${data.actorName} added you to the project ${project}.\n\nOpen it: ${projectLink}\n`,
      };
  }
}
