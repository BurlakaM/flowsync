import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENT,
  type DeliveredDomainEvent,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailQueue: MailQueueService,
    private readonly config: AppConfigService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Errors are not caught on purpose: a failure makes the outbox retry the event, and `notify` is safe
   * to repeat (one notification per event and person).
   */
  @OnEvent(DOMAIN_EVENT)
  async handle(event: DeliveredDomainEvent): Promise<void> {
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
    event: DeliveredDomainEvent,
    candidates: number[],
    type: NotificationType,
    extra: Pick<NotificationData, 'taskId' | 'taskName' | 'excerpt'>,
  ): Promise<void> {
    // Nobody needs a notification about what they did themselves.
    const recipientIds = [...new Set(candidates)].filter(
      (id) => id !== event.actorId,
    );
    if (recipientIds.length === 0) return;

    // Recipients already notified about this very event (a redelivery) are skipped, so they get neither a
    // second notification nor a second email.
    const already = await this.prisma.notification.findMany({
      where: { eventId: event.id, userId: { in: recipientIds } },
      select: { userId: true },
    });
    const fresh = recipientIds.filter(
      (id) => !already.some((row) => row.userId === id),
    );
    if (fresh.length === 0) return;

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
        where: { id: { in: fresh } },
        select: { id: true, email: true, emailVerifiedAt: true },
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
        eventId: event.id,
      })),
      // Two deliveries racing each other: the unique (eventId, userId) keeps it to one row.
      skipDuplicates: true,
    });

    // Open browsers of the recipients refresh their bell at once.
    this.emitter.emit(
      NOTIFICATIONS_CREATED,
      recipients.map((recipient) => recipient.id),
    );

    const content = buildEmail(type, data, this.config.appUrl);
    // Email only goes to addresses whose owner confirmed them: nobody can have mail sent to a stranger
    // by signing up with that address. The in-app notification above is for everyone.
    await Promise.all(
      recipients
        .filter((recipient) => recipient.emailVerifiedAt)
        .map((recipient) =>
          this.mailQueue.enqueue({ to: recipient.email, ...content }),
        ),
    );
  }
}
