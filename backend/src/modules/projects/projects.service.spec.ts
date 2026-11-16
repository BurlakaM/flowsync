import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { ProjectsService } from './projects.service';

const date = new Date('2026-01-01T00:00:00Z');

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'P',
    description: null,
    image: null,
    ownerId: 10,
    createdAt: date,
    updatedAt: date,
    _count: { tasks: 3 },
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProjectsService(prisma);
  });

  it('describes access as "owner or member"', () => {
    expect(service.accessFilter(7)).toEqual({
      OR: [{ ownerId: 7 }, { members: { some: { userId: 7 } } }],
    });
  });

  describe('assertAccess / assertOwner', () => {
    it('treats a project the user cannot see as missing', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.assertAccess(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets the owner through', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 5,
        ownerId: 1,
      } as never);

      expect(await service.assertOwner(1, 5)).toEqual({ id: 5, ownerId: 1 });
    });

    it('rejects a plain member with 403', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 5,
        ownerId: 99,
      } as never);

      await expect(service.assertOwner(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('makes the caller the owner', async () => {
      prisma.project.create.mockResolvedValue(
        projectRow({ ownerId: 10 }) as never,
      );

      const project = await service.create(10, { name: 'P' });

      expect(prisma.project.create.mock.calls[0][0].data).toMatchObject({
        name: 'P',
        ownerId: 10,
      });
      expect(project).toMatchObject({ myRole: 'OWNER', tasksCount: 3 });
      expect(project).not.toHaveProperty('_count');
    });
  });

  describe('list', () => {
    const query = (extra: Partial<QueryProjectsDto> = {}) =>
      Object.assign(new QueryProjectsDto(), { page: 1, limit: 20 }, extra);

    it('marks the role of the caller in every project', async () => {
      prisma.project.findMany.mockResolvedValue([
        projectRow({ id: 1, ownerId: 10 }),
        projectRow({ id: 2, ownerId: 99 }),
      ] as never);
      prisma.project.count.mockResolvedValue(2);

      const page = await service.list(10, query());

      expect(page.items.map((item) => item.myRole)).toEqual([
        'OWNER',
        'MEMBER',
      ]);
      expect(page.meta.total).toBe(2);
    });

    it('limits the list to accessible projects and applies the search', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);

      await service.list(10, query({ search: 'dem' }));

      expect(prisma.project.findMany.mock.calls[0][0]?.where).toEqual({
        OR: [{ ownerId: 10 }, { members: { some: { userId: 10 } } }],
        name: { contains: 'dem', mode: 'insensitive' },
      });
    });
  });

  describe('get', () => {
    it('throws NotFoundException for a project the user cannot see', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.get(1, 5)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists the owner first, then the other members', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectRow({
          owner: { id: 10, name: 'Owner', email: 'o@x.test' },
          members: [
            { createdAt: date, user: { id: 20, name: 'M', email: 'm@x.test' } },
          ],
        }) as never,
      );

      const project = await service.get(20, 1);

      expect(project.owner).toEqual({ id: 10, name: 'Owner' });
      expect(project.members.map((m) => [m.userId, m.role])).toEqual([
        [10, 'OWNER'],
        [20, 'MEMBER'],
      ]);
      expect(project.myRole).toBe('MEMBER');
    });
  });

  describe('update and remove', () => {
    it('are limited to the owner', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 99,
      } as never);

      await expect(service.update(1, 1, { name: 'X' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.remove(1, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });

    it('update changes the project for the owner', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 10,
      } as never);
      prisma.project.update.mockResolvedValue(
        projectRow({ name: 'New' }) as never,
      );

      const project = await service.update(10, 1, { name: 'New' });

      expect(project.name).toBe('New');
    });

    it('remove deletes the project for the owner', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 10,
      } as never);

      await service.remove(10, 1);

      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('addMember', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 10,
      } as never);
    });

    it('throws NotFoundException for an unregistered email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(10, 1, { email: 'nobody@x.test' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects the owner and existing members with 409', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 10,
        name: 'O',
        email: 'o@x.test',
      } as never);
      await expect(
        service.addMember(10, 1, { email: 'o@x.test' }),
      ).rejects.toBeInstanceOf(ConflictException);

      prisma.user.findUnique.mockResolvedValue({
        id: 20,
        name: 'M',
        email: 'm@x.test',
      } as never);
      prisma.projectMember.findUnique.mockResolvedValue({
        userId: 20,
      } as never);
      await expect(
        service.addMember(10, 1, { email: 'm@x.test' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('adds a registered user as a member', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 20,
        name: 'M',
        email: 'm@x.test',
      } as never);
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.projectMember.create.mockResolvedValue({
        createdAt: date,
      } as never);

      expect(await service.addMember(10, 1, { email: 'm@x.test' })).toEqual({
        userId: 20,
        name: 'M',
        email: 'm@x.test',
        role: 'MEMBER',
        joinedAt: date,
      });
    });

    it('only the owner may add members', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 99,
      } as never);

      await expect(
        service.addMember(10, 1, { email: 'm@x.test' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: 1,
        ownerId: 10,
      } as never);
    });

    it('never removes the owner', async () => {
      await expect(service.removeMember(10, 1, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not let a member remove someone else', async () => {
      await expect(service.removeMember(20, 1, 30)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lets a member leave', async () => {
      prisma.projectMember.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeMember(20, 1, 20);

      expect(prisma.projectMember.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 1, userId: 20 },
      });
    });

    it('lets the owner remove a member and reports a missing one', async () => {
      prisma.projectMember.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeMember(10, 1, 20)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
