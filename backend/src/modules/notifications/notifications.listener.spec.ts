import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep } from 'vitest-mock-extended';
import type { DeliveredDomainEvent } from '../../common/events/domain-event';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import type { MailQueueService } from '../mail/mail-queue.service';
import { NotificationsListener } from './notifications.listener';

const ACTOR = 1;
const event = (
  overrides: Partial<DeliveredDomainEvent>,
): DeliveredDomainEvent => ({
  id: 'evt-1',
  type: 'task.created',
  actorId: ACTOR,
  projectId: 7,
  entityType: 'Task',
  entityId: 9,
  data: { name: 'Fix login', assigneeIds: [] },
  ...overrides,
});

describe('NotificationsListener', () => {
  const prisma = mockDeep<PrismaService>();
  const enqueue = vi.fn();
  const emit = vi.fn();
  const listener = new NotificationsListener(
    prisma,
    { enqueue } as unknown as MailQueueService,
    { appUrl: 'https://app.example' } as AppConfigService,
    { emit } as unknown as EventEmitter2,
  );

  const users = (...ids: number[]) =>
    ids.map((id) => ({
      id,
      email: `u${id}@example.test`,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    }));

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ name: 'Ann' } as never);
    prisma.project.findUnique.mockResolvedValue({ name: 'Roadmap' } as never);
    prisma.notification.findMany.mockResolvedValue([]);
  });

  const created = () => prisma.notification.createMany.mock.calls[0]?.[0];

  it('notifies the people a task was assigned to, but not the one who assigned it', async () => {
    prisma.user.findMany.mockResolvedValue(users(2, 3) as never);

    await listener.handle(
      event({ data: { name: 'Fix login', assigneeIds: [1, 2, 3, 2] } }),
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [2, 3] } } }),
    );
    expect(created()).toEqual({
      data: [
        expect.objectContaining({ userId: 2, type: 'task.assigned' }),
        expect.objectContaining({ userId: 3, type: 'task.assigned' }),
      ],
      skipDuplicates: true,
    });
  });

  it('stores what the client needs to write the sentence', async () => {
    prisma.user.findMany.mockResolvedValue(users(2) as never);

    await listener.handle(
      event({ data: { name: 'Fix login', assigneeIds: [2] } }),
    );

    expect((created()?.data as { data: unknown }[])[0].data).toEqual({
      actorName: 'Ann',
      projectId: 7,
      projectName: 'Roadmap',
      taskId: 9,
      taskName: 'Fix login',
    });
  });

  it('tells the real-time gateway who just received notifications', async () => {
    prisma.user.findMany.mockResolvedValue(users(2, 3) as never);

    await listener.handle(
      event({ data: { name: 'Fix login', assigneeIds: [2, 3] } }),
    );

    expect(emit).toHaveBeenCalledWith('notifications.created', [2, 3]);
  });

  it('queues one email per recipient with a link into the application', async () => {
    prisma.user.findMany.mockResolvedValue(users(2, 3) as never);

    await listener.handle(
      event({ data: { name: 'Fix login', assigneeIds: [2, 3] } }),
    );

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u2@example.test',
        subject: 'Ann assigned you to “Fix login”',
        text: expect.stringContaining('https://app.example/tasks/9'),
      }),
    );
  });

  it('emails only addresses that were confirmed, but notifies everyone in the application', async () => {
    prisma.user.findMany.mockResolvedValue([
      ...users(2),
      { id: 3, email: 'u3@example.test', emailVerifiedAt: null },
    ] as never);

    await listener.handle(
      event({ data: { name: 'Fix login', assigneeIds: [2, 3] } }),
    );

    expect(created()?.data).toHaveLength(2);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u2@example.test' }),
    );
  });

  it('notifies only the people added by an update', async () => {
    prisma.user.findMany.mockResolvedValue(users(5) as never);

    await listener.handle(
      event({
        type: 'task.updated',
        data: {
          name: 'Fix login',
          changed: ['assignees'],
          assigneesAdded: [5],
        },
      }),
    );

    expect(created()?.data).toHaveLength(1);
  });

  it('does nothing for an update that added nobody', async () => {
    await listener.handle(
      event({
        type: 'task.updated',
        data: { name: 'Fix', changed: ['status'], assigneesAdded: [] },
      }),
    );

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('tells the author and the assignees of a task about a new comment, except the commenter', async () => {
    prisma.task.findUnique.mockResolvedValue({
      createdById: 4,
      assignees: [{ userId: 1 }, { userId: 6 }, { userId: 4 }],
    } as never);
    prisma.user.findMany.mockResolvedValue(users(4, 6) as never);

    await listener.handle(
      event({
        type: 'comment.created',
        entityType: 'Comment',
        data: { taskId: 9, taskName: 'Fix login', excerpt: 'Looks good' },
      }),
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [4, 6] } } }),
    );
    expect(created()?.data).toEqual([
      expect.objectContaining({ userId: 4, type: 'comment.added' }),
      expect.objectContaining({ userId: 6, type: 'comment.added' }),
    ]);
  });

  it('notifies nobody about a comment on a task whose author was deleted and has no assignees', async () => {
    prisma.task.findUnique.mockResolvedValue({
      createdById: null,
      assignees: [],
    } as never);

    await listener.handle(
      event({
        type: 'comment.created',
        data: { taskId: 9, taskName: 'Fix', excerpt: 'x' },
      }),
    );

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('invites a user who was added to a project', async () => {
    prisma.user.findMany.mockResolvedValue(users(8) as never);

    await listener.handle(
      event({
        type: 'member.added',
        entityType: 'Member',
        entityId: 8,
        data: {},
      }),
    );

    expect(created()?.data).toEqual([
      expect.objectContaining({ userId: 8, type: 'project.invited' }),
    ]);
  });

  it('ignores events nobody needs to hear about', async () => {
    await listener.handle(event({ type: 'tag.created', entityType: 'Tag' }));
    await listener.handle(event({ type: 'task.deleted' }));

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('lets a failure out so that the outbox retries the event', async () => {
    prisma.project.findUnique.mockRejectedValue(new Error('db down'));
    prisma.user.findMany.mockResolvedValue(users(2) as never);

    await expect(
      listener.handle(event({ data: { name: 'T', assigneeIds: [2] } })),
    ).rejects.toThrow('db down');
  });

  describe('redelivery of the same event', () => {
    it('notifies and mails only the people who were not notified yet', async () => {
      prisma.notification.findMany.mockResolvedValue([{ userId: 2 }] as never);
      prisma.user.findMany.mockResolvedValue(users(3) as never);

      await listener.handle(
        event({ data: { name: 'Fix login', assigneeIds: [2, 3] } }),
      );

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: 'evt-1', userId: { in: [2, 3] } },
        }),
      );
      expect(created()?.data).toEqual([
        expect.objectContaining({ userId: 3, eventId: 'evt-1' }),
      ]);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith('notifications.created', [3]);
    });

    it('does nothing when everybody was notified already', async () => {
      prisma.notification.findMany.mockResolvedValue([
        { userId: 2 },
        { userId: 3 },
      ] as never);

      await listener.handle(
        event({ data: { name: 'Fix login', assigneeIds: [2, 3] } }),
      );

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
