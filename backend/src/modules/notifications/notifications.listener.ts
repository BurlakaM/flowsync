import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENT,
  type DomainEvent,
} from '../../common/events/domain-event';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { NOTIFICATIONS_CREATED } from './notifications.events';
import {
  buildEmail,
  type NotificationData,
  type NotificationType,
} from './notification-content';

const numbers = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : [];

/** Turns domain events into notifications for the people they concern. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailQueue: MailQueueService,
    private readonly config: AppConfigService,
    private readonly emitter: EventEmitter2,
  ) {}

  @OnEvent(DOMAIN_EVENT)
  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'task.created':
          return await this.notify(
            event,
            numbers(event.data.assigneeIds),
            'task.assigned',
            { taskId: event.entityId, taskName: String(event.data.name) },
          );
        case 'task.updated':
          return await this.notify(
            event,
            numbers(event.data.assigneesAdded),
            'task.assigned',
            { taskId: event.entityId, taskName: String(event.data.name) },
          );
        case 'comment.created':
          return await this.notify(
            event,
            await this.interestedInTask(Number(event.data.taskId)),
            'comment.added',
            {
              taskId: Number(event.data.taskId),
              taskName: String(event.data.taskName),
              excerpt: String(event.data.excerpt ?? ''),
            },
          );
        case 'member.added':
          return await this.notify(
            event,
            [event.entityId],
            'project.invited',
            {},
          );
        default:
          return;
      }
    } catch (error) {
      // The change that caused this is saved already; a lost notification must not become an error.
      this.logger.error(
        `Could not notify about ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** The author and the assignees of a task: the people who care about its discussion. */
  private async interestedInTask(taskId: number): Promise<number[]> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        createdById: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) return [];
    return [
      ...(task.createdById ? [task.createdById] : []),
      ...task.assignees.map((assignee) => assignee.userId),
    ];
  }

  private async notify(
    event: DomainEvent,
    candidates: number[],
    type: NotificationType,
    extra: Pick<NotificationData, 'taskId' | 'taskName' | 'excerpt'>,
  ): Promise<void> {
    // Nobody needs a notification about what they did themselves.
    const recipientIds = [...new Set(candidates)].filter(
      (id) => id !== event.actorId,
    );
    if (recipientIds.length === 0) return;

    const [actor, project, recipients] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: event.actorId },
        select: { name: true },
      }),
      this.prisma.project.findUnique({
        where: { id: event.projectId },
        select: { name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true },
      }),
    ]);
    if (!project) return;

    const data: NotificationData = {
      actorName: actor?.name ?? 'Someone',
      projectId: event.projectId,
      projectName: project.name,
      ...extra,
    };
    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type,
        data: data as unknown as Prisma.InputJsonObject,
      })),
    });

    // Open browsers of the recipients refresh their bell at once.
    this.emitter.emit(
      NOTIFICATIONS_CREATED,
      recipients.map((recipient) => recipient.id),
    );

    const content = buildEmail(type, data, this.config.appUrl);
    await Promise.all(
      recipients.map((recipient) =>
        this.mailQueue.enqueue({ to: recipient.email, ...content }),
      ),
    );
  }
}
