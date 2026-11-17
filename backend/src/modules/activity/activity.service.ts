import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CursorQueryDto,
  decodeCursor,
  toCursorPage,
  type CursorPage,
} from '../../common/pagination/cursor';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityResponseDto } from './dto/activity-response.dto';

const activitySelect = {
  id: true,
  type: true,
  entityType: true,
  entityId: true,
  data: true,
  createdAt: true,
  actor: { select: { id: true, name: true } },
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * The latest changes of a project, newest first, by cursor: the feed grows all the time, and offset
   * pages would repeat or skip entries while the reader pages. Everyone who can see the project can read it.
   */
  async list(
    userId: number,
    projectId: number,
    query: CursorQueryDto,
  ): Promise<CursorPage<ActivityResponseDto>> {
    await this.projects.assertAccess(userId, projectId);

    const before = decodeCursor(query.cursor);
    const rows = await this.prisma.auditLog.findMany({
      where: { projectId, ...(before !== undefined && { id: { lt: before } }) },
      select: activitySelect,
      // Newest first. Ids grow with time, so the id is both the order and the cursor.
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    return toCursorPage(
      rows.map((row) => ({
        ...row,
        data: row.data as Record<string, unknown>,
      })),
      query.limit,
    );
  }
}
