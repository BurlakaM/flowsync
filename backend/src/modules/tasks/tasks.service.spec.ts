import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { TasksSearchService } from './tasks-search.service';
import { TasksService } from './tasks.service';

const date = new Date('2026-01-01T00:00:00Z');
const ACCESS = { OR: [{ ownerId: 1 }] };

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'T',
    description: null,
    status: 'TODO',
    version: 1,
    projectId: 3,
    createdById: 1,
    createdAt: date,
    updatedAt: date,
    assignees: [{ user: { id: 5, name: 'Ann' } }],
    tags: [{ id: 6, name: 'bug' }],
    _count: { comments: 2 },
    project: { id: 3, name: 'P' },
    createdBy: { id: 1, name: 'Owner' },
    ...overrides,
  };
}

const publish = vi.fn();

describe('TasksService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  const assertAccess = vi.fn();
  const rankedIds = vi.fn();
  let service: TasksService;

  const query = (extra: Partial<QueryTasksDto> = {}) =>
    Object.assign(new QueryTasksDto(), { page: 1, limit: 20 }, extra);

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    assertAccess.mockReset().mockResolvedValue({ id: 3, ownerId: 1 });
    const projects = {
      accessFilter: vi.fn().mockReturnValue(ACCESS),
      assertAccess,
    } as unknown as ProjectsService;
    publish.mockReset();
    rankedIds.mockReset().mockResolvedValue([]);
    service = new TasksService(
      prisma,
      projects,
      {
        rankedIds,
      } as unknown as TasksSearchService,
      {
        // The real service runs the work in a transaction; here the mocked client plays the transaction.
        transact: (work: (tx: unknown, emit: unknown) => unknown) =>
          work(prisma, publish),
      } as unknown as DomainEventsService,
    );
  });

  describe('list', () => {
    it('scopes the list to the project of the URL after checking access', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.list(1, query(), 3);

      expect(assertAccess).toHaveBeenCalledWith(1, 3);
      expect(prisma.task.findMany.mock.calls[0][0]?.where).toMatchObject({
        project: ACCESS,
        projectId: 3,
      });
    });

    it('does not run the query for a project the user cannot see', async () => {
      assertAccess.mockRejectedValue(new NotFoundException());

      await expect(service.list(1, query(), 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('applies the filters, the search and the sort order', async () => {
      rankedIds.mockResolvedValue([11, 12]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.list(
        1,
        query({
          projectId: 4,
          status: 'DONE',
          assigneeId: 5,
          tagId: 6,
          search: 'login',
          sortBy: 'name',
          order: 'asc',
        }),
      );

      const args = prisma.task.findMany.mock.calls[0][0];
      expect(assertAccess).not.toHaveBeenCalled();
      expect(args?.where).toMatchObject({
        projectId: 4,
        status: 'DONE',
        assignees: { some: { userId: 5 } },
        tags: { some: { id: 6 } },
        id: { in: [11, 12] },
      });
      expect(rankedIds).toHaveBeenCalledWith('login', 4);
      expect(args?.orderBy).toEqual([{ name: 'asc' }, { id: 'desc' }]);
    });

    it('finds nothing when the search matches nothing, and still checks access', async () => {
      rankedIds.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.list(1, query({ search: 'zzz' }));

      expect(prisma.task.findMany.mock.calls[0][0]?.where).toMatchObject({
        project: ACCESS,
        id: { in: [] },
      });
    });

    it('orders by relevance and drops matches the user cannot see', async () => {
      rankedIds.mockResolvedValue([30, 20, 10]);
      // Task 20 belongs to a foreign project: access filtering removes it.
      prisma.task.findMany
        .mockResolvedValueOnce([{ id: 10 }, { id: 30 }] as never)
        .mockResolvedValueOnce([
          taskRow({ id: 10 }),
          taskRow({ id: 30 }),
        ] as never);

      const page = await service.list(
        1,
        query({ search: 'login', sortBy: 'relevance' }),
      );

      expect(page.items.map((item) => item.id)).toEqual([30, 10]);
      expect(page.meta.total).toBe(2);
      expect(prisma.task.findMany.mock.calls[0][0]?.where).toMatchObject({
        project: ACCESS,
        id: { in: [30, 20, 10] },
      });
    });

    it('treats relevance without a search as the default order', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.list(1, query({ sortBy: 'relevance', order: 'desc' }));

      expect(prisma.task.findMany.mock.calls[0][0]?.orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);
      expect(rankedIds).not.toHaveBeenCalled();
    });

    it('flattens assignees and counts comments', async () => {
      prisma.task.findMany.mockResolvedValue([taskRow()] as never);
      prisma.task.count.mockResolvedValue(21);

      const page = await service.list(1, query({ limit: 10 }));

      expect(page.items[0]).toMatchObject({
        assignees: [{ id: 5, name: 'Ann' }],
        commentsCount: 2,
      });
      expect(page.items[0]).not.toHaveProperty('_count');
      expect(page.meta.totalPages).toBe(3);
    });
  });

  describe('create', () => {
    const dto = { name: 'T', assigneeIds: [5], tagIds: [6] };

    it('rejects assignees who are not members of the project', async () => {
      prisma.user.count.mockResolvedValue(0);

      await expect(service.create(1, 3, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('rejects tags of another project', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(0);

      await expect(service.create(1, 3, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates the task with the author, assignees and tags', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(1);
      prisma.task.create.mockResolvedValue(taskRow() as never);

      const task = await service.create(1, 3, dto);

      expect(prisma.task.create.mock.calls[0][0].data).toMatchObject({
        name: 'T',
        project: { connect: { id: 3 } },
        createdBy: { connect: { id: 1 } },
        assignees: { create: [{ userId: 5 }] },
        tags: { connect: [{ id: 6 }] },
      });
      expect(task.project).toEqual({ id: 3, name: 'P' });
      expect(task.createdBy).toEqual({ id: 1, name: 'Owner' });
    });

    it('skips assignees and tags when none are sent', async () => {
      prisma.task.create.mockResolvedValue(taskRow() as never);

      await service.create(1, 3, { name: 'T' });

      const { data } = prisma.task.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('assignees');
      expect(data).not.toHaveProperty('tags');
    });
  });

  describe('get', () => {
    it('throws NotFoundException when the task is not visible', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.get(1, 9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.task.findFirst.mockResolvedValue({
        id: 1,
        name: 'T',
        description: null,
        status: 'TODO',
        projectId: 3,
        createdById: 1,
        assignees: [],
        tags: [],
        project: { ownerId: 1 },
      } as never);
      prisma.task.update.mockResolvedValue(taskRow() as never);
    });

    it('publishes what changed, including the new assignees', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(0);
      prisma.task.update.mockResolvedValue(
        taskRow({ name: 'Renamed', status: 'DONE' }) as never,
      );

      await service.update(1, 1, {
        version: 1,
        name: 'Renamed',
        status: 'DONE',
        assigneeIds: [5],
      });

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith({
        type: 'task.updated',
        actorId: 1,
        projectId: 3,
        entityType: 'Task',
        entityId: 1,
        data: {
          name: 'Renamed',
          changed: ['name', 'status', 'assignees', 'tags'],
          status: { from: 'TODO', to: 'DONE' },
          assigneesAdded: [5],
        },
      });
    });

    it('publishes nothing when the update fails', async () => {
      prisma.task.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.update(1, 1, { version: 1, name: 'X' }),
      ).rejects.toThrow();
      expect(publish).not.toHaveBeenCalled();
    });

    it('replaces assignees and tags only when they are sent', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(0);

      await service.update(1, 1, {
        version: 1,
        status: 'DONE',
        assigneeIds: [5],
        tagIds: [],
      });

      expect(prisma.task.update.mock.calls[0][0].data).toMatchObject({
        status: 'DONE',
        assignees: { deleteMany: {}, create: [{ userId: 5 }] },
        tags: { set: [] },
      });
    });

    it('leaves assignees and tags alone when they are omitted', async () => {
      await service.update(1, 1, { version: 1, name: 'Renamed' });

      const { data } = prisma.task.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('assignees');
      expect(data).not.toHaveProperty('tags');
    });

    it('writes only while the stored version is the one the client saw, and bumps it', async () => {
      await service.update(1, 1, { version: 4, name: 'Renamed' });

      const args = prisma.task.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 1, version: 4 });
      expect(args.data).toMatchObject({ version: { increment: 1 } });
    });

    it('answers 409 when somebody saved the task first', async () => {
      prisma.task.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      prisma.task.findUnique.mockResolvedValue({ version: 5 } as never);

      await expect(
        service.update(1, 1, { version: 4, name: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(publish).not.toHaveBeenCalled();
    });

    it('answers 404 when the task was deleted in the meantime', async () => {
      prisma.task.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.update(1, 1, { version: 1, name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates against the project of the task', async () => {
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update(1, 1, { version: 1, assigneeIds: [5] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const accessible = (createdById: number | null, ownerId: number) =>
      prisma.task.findFirst.mockResolvedValue({
        id: 1,
        projectId: 3,
        createdById,
        project: { ownerId },
      } as never);

    it('lets the author delete the task', async () => {
      accessible(2, 1);

      await service.remove(2, 1);

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('lets the project owner delete any task', async () => {
      accessible(2, 1);

      await service.remove(1, 1);

      expect(prisma.task.delete).toHaveBeenCalled();
    });

    it('forbids other members', async () => {
      accessible(2, 1);

      await expect(service.remove(3, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('treats an invisible task as missing', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.remove(1, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
