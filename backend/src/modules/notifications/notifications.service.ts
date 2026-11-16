import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationResponseDto,
  QueryNotificationsDto,
  UnreadCountDto,
} from './dto/notification.dto';

const notificationSelect = {
  id: true,
  type: true,
  data: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** A notification belongs to one user; someone else's looks like a missing one (404). */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: number,
    query: QueryNotificationsDto,
  ): Promise<Page<NotificationResponseDto>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread && { readAt: null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    const items = rows.map((row) => ({
      ...row,
      data: row.data as Record<string, unknown>,
    }));
    return toPage(items, total, query);
  }

  async unreadCount(userId: number): Promise<UnreadCountDto> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: number, id: number): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Notification not found');
  }

  async markAllRead(userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
