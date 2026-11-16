import { NotFoundException } from '@nestjs/common';
import { mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import { QueryNotificationsDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

const query = (extra: Partial<QueryNotificationsDto> = {}) =>
  Object.assign(new QueryNotificationsDto(), { page: 1, limit: 20 }, extra);

describe('NotificationsService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new NotificationsService(prisma);

  beforeEach(() => vi.resetAllMocks());

  it('lists only the notifications of the user, newest first', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await service.list(5, query());

    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 5 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('can limit the list to unread notifications', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await service.list(5, query({ unread: true }));

    expect(prisma.notification.findMany.mock.calls[0][0]?.where).toEqual({
      userId: 5,
      readAt: null,
    });
  });

  it('counts the unread notifications of the user', async () => {
    prisma.notification.count.mockResolvedValue(3);

    expect(await service.unreadCount(5)).toEqual({ count: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 5, readAt: null },
    });
  });

  it('marks a notification of the user as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await service.markRead(5, 12);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 12, userId: 5 },
      data: { readAt: expect.any(Date) },
    });
  });

  it("treats someone else's notification as missing", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markRead(5, 12)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks everything of the user as read, and only the unread ones', async () => {
    await service.markAllRead(5);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 5, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
