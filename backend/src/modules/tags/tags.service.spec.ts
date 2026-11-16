import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TagsService } from './tags.service';

const publish = vi.fn();

describe('TagsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  const assertAccess = vi.fn();
  let service: TagsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    publish.mockReset();
    assertAccess.mockReset().mockResolvedValue({ id: 3, ownerId: 1 });
    service = new TagsService(
      prisma,
      {
        accessFilter: vi.fn().mockReturnValue({}),
        assertAccess,
      } as unknown as ProjectsService,
      { publish } as unknown as DomainEventsService,
    );
  });

  describe('list and create', () => {
    it('require access to the project', async () => {
      assertAccess.mockRejectedValue(new NotFoundException());

      await expect(service.list(1, 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.create(1, 3, { name: 'bug' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists the tags of the project alphabetically', async () => {
      prisma.tag.findMany.mockResolvedValue([]);

      await service.list(1, 3);

      expect(prisma.tag.findMany.mock.calls[0][0]).toMatchObject({
        where: { projectId: 3 },
        orderBy: { name: 'asc' },
      });
    });

    it('rejects a duplicate name inside the project', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 9 } as never);

      await expect(
        service.create(1, 3, { name: 'bug' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.tag.create).not.toHaveBeenCalled();
    });

    it('creates a tag with a free name', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({ id: 1 } as never);

      await service.create(1, 3, { name: 'bug' });

      expect(prisma.tag.create.mock.calls[0][0].data).toEqual({
        name: 'bug',
        projectId: 3,
      });
    });
  });

  describe('update and remove', () => {
    const existing = (ownerId: number) =>
      prisma.tag.findFirst.mockResolvedValue({
        id: 1,
        name: 'bug',
        projectId: 3,
        project: { ownerId },
      } as never);

    it('treats an invisible tag as missing', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(service.update(1, 1, { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('renames to a free name and refuses a taken one', async () => {
      existing(1);
      prisma.tag.update.mockResolvedValue({ id: 1 } as never);

      prisma.tag.findUnique.mockResolvedValue(null);
      await service.update(1, 1, { name: 'defect' });
      expect(prisma.tag.update).toHaveBeenCalled();

      prisma.tag.findUnique.mockResolvedValue({ id: 2 } as never);
      await expect(
        service.update(1, 1, { name: 'feature' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not check the name when it did not change', async () => {
      existing(1);
      prisma.tag.update.mockResolvedValue({ id: 1 } as never);

      await service.update(1, 1, { name: 'bug' });

      expect(prisma.tag.findUnique).not.toHaveBeenCalled();
    });

    it('lets only the project owner delete a tag', async () => {
      existing(1);
      await service.remove(1, 1);
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });

      await expect(service.remove(2, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
