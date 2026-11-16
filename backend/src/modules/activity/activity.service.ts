import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
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

  /** The latest changes of a project, newest first. Everyone who can see the project can read it. */
  async list(
    userId: number,
    projectId: number,
    query: PaginationQueryDto,
  ): Promise<Page<ActivityResponseDto>> {
    await this.projects.assertAccess(userId, projectId);

    const where = { projectId };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: activitySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((row) => ({
      ...row,
      data: row.data as Record<string, unknown>,
    }));
    return toPage(items, total, query);
  }
}
