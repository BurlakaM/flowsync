import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { CommentsService } from './comments.service';

const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });

describe('CommentsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  const assertTaskAccess = vi.fn();
  let service: CommentsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    assertTaskAccess.mockReset().mockResolvedValue({ id: 7 });
    service = new CommentsService(
      prisma,
      {
        accessFilter: vi.fn().mockReturnValue({}),
      } as unknown as ProjectsService,
      { assertTaskAccess } as unknown as TasksService,
    );
  });

  describe('list and create', () => {
    it('requires access to the task', async () => {
      assertTaskAccess.mockRejectedValue(new NotFoundException());

      await expect(service.list(1, 7, query)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.create(1, 7, { text: 'hi' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.comment.findMany).not.toHaveBeenCalled();
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('lists the comments of the task oldest first', async () => {
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      await service.list(1, 7, query);

      expect(prisma.comment.findMany.mock.calls[0][0]).toMatchObject({
        where: { taskId: 7 },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    });

    it('takes the author from the caller, never from the input', async () => {
      prisma.comment.create.mockResolvedValue({ id: 1 } as never);

      await service.create(4, 7, { text: 'hi' });

      expect(prisma.comment.create.mock.calls[0][0].data).toEqual({
        text: 'hi',
        task: { connect: { id: 7 } },
        author: { connect: { id: 4 } },
      });
    });
  });

  describe('update and remove', () => {
    const existing = (authorId: number | null, ownerId: number) =>
      prisma.comment.findFirst.mockResolvedValue({
        id: 1,
        authorId,
        task: { project: { ownerId } },
      } as never);

    it('treats an invisible comment as missing', async () => {
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(service.update(1, 1, { text: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.remove(1, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets only the author edit', async () => {
      existing(2, 9);
      prisma.comment.update.mockResolvedValue({ id: 1 } as never);

      await service.update(2, 1, { text: 'edited' });
      expect(prisma.comment.update).toHaveBeenCalled();

      await expect(
        service.update(9, 1, { text: 'hijack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the author and the project owner delete, nobody else', async () => {
      existing(2, 9);

      await service.remove(2, 1);
      await service.remove(9, 1);
      expect(prisma.comment.delete).toHaveBeenCalledTimes(2);

      await expect(service.remove(3, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
