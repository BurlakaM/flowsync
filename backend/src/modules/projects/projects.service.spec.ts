import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { StorageService } from '../../common/storage/storage.service';
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

const publish = vi.fn();
const storage = {
  put: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
};

describe('ProjectsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    publish.mockReset();
    Object.values(storage).forEach((fn) => fn.mockReset());
    service = new ProjectsService(
      prisma,
      { publish } as unknown as DomainEventsService,
      storage as unknown as StorageService,
    );
  });

  it('describes access as "owner or member"', () => {
    expect(service.accessFilter(7)).toEqual({
      OR: [{ ownerId: 7 }, { members: { some: { userId: 7 } } }],
    });
  });

  describe('assertAccess', () => {
    it('treats a project the user cannot see as missing', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.assertAccess(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the project for a user who can see it', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 5,
        ownerId: 99,
      } as never);

      expect(await service.assertAccess(1, 5)).toEqual({ id: 5, ownerId: 99 });
    });
  });

  describe('owner-only actions', () => {
    it.each([
      ['update', () => service.update(1, 5, { name: 'X' })],
      ['remove', () => service.remove(1, 5)],
      ['addMember', () => service.addMember(1, 5, { email: 'a@b.co' })],
    ])(
      '%s rejects a plain member with 403 and changes nothing',
      async (_name, run) => {
        prisma.project.findFirst.mockResolvedValue({
          id: 5,
          ownerId: 99,
        } as never);

        await expect(run()).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.project.update).not.toHaveBeenCalled();
        expect(prisma.project.delete).not.toHaveBeenCalled();
        expect(prisma.projectMember.create).not.toHaveBeenCalled();
      },
    );
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

  describe('project picture', () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    const owned = () =>
      prisma.project.findFirst.mockResolvedValue({
        id: 5,
        ownerId: 1,
        name: 'P',
      } as never);

    describe('setImage', () => {
      it('stores the picture under a key of the project and removes the old one', async () => {
        owned();
        prisma.project.findUnique.mockResolvedValue({
          image: 'old-key',
        } as never);
        prisma.project.update.mockResolvedValue(
          projectRow({ id: 5, ownerId: 1, image: 'new' }) as never,
        );

        const project = await service.setImage(1, 5, { buffer: png });

        const [key, body, type] = storage.put.mock.calls[0];
        expect(key).toMatch(/^projects\/5\/[0-9a-f-]{36}\.png$/);
        expect(body).toBe(png);
        expect(type).toBe('image/png');
        expect(prisma.project.update.mock.calls[0][0].data).toEqual({
          image: key,
        });
        expect(storage.remove).toHaveBeenCalledWith('old-key');
        expect(project.hasImage).toBe(true);
        expect(project).not.toHaveProperty('image');
        expect(publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'project.updated',
            data: { name: 'P', image: 'changed' },
          }),
        );
      });

      it('refuses a file that is not an image, whatever it is called', async () => {
        owned();

        await expect(
          service.setImage(1, 5, {
            buffer: Buffer.from('<svg onload=alert(1)>'),
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(storage.put).not.toHaveBeenCalled();
      });

      it('is for the owner only and stores nothing otherwise', async () => {
        prisma.project.findFirst.mockResolvedValue({
          id: 5,
          ownerId: 99,
          name: 'P',
        } as never);

        await expect(
          service.setImage(1, 5, { buffer: png }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(storage.put).not.toHaveBeenCalled();
      });

      it('hides the project from someone who cannot see it', async () => {
        prisma.project.findFirst.mockResolvedValue(null);

        await expect(
          service.setImage(1, 5, { buffer: png }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('removeImage', () => {
      it('clears the key and deletes the object', async () => {
        owned();
        prisma.project.findUnique.mockResolvedValue({ image: 'key' } as never);

        await service.removeImage(1, 5);

        expect(prisma.project.update.mock.calls[0][0].data).toEqual({
          image: null,
        });
        expect(storage.remove).toHaveBeenCalledWith('key');
        expect(publish).toHaveBeenCalledWith(
          expect.objectContaining({ data: { name: 'P', image: 'removed' } }),
        );
      });

      it('does nothing for a project without a picture', async () => {
        owned();
        prisma.project.findUnique.mockResolvedValue({ image: null } as never);

        await service.removeImage(1, 5);

        expect(prisma.project.update).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      });

      it('is for the owner only', async () => {
        prisma.project.findFirst.mockResolvedValue({
          id: 5,
          ownerId: 99,
          name: 'P',
        } as never);

        await expect(service.removeImage(1, 5)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });
    });

    describe('getImage', () => {
      it('returns the stored picture', async () => {
        owned();
        prisma.project.findUnique.mockResolvedValue({ image: 'key' } as never);
        const object = { body: {}, contentType: 'image/png' };
        storage.get.mockResolvedValue(object);

        expect(await service.getImage(1, 5)).toBe(object);
        expect(storage.get).toHaveBeenCalledWith('key');
      });

      it('is a 404 when there is no picture or the object is gone', async () => {
        owned();
        prisma.project.findUnique.mockResolvedValue({ image: null } as never);
        await expect(service.getImage(1, 5)).rejects.toBeInstanceOf(
          NotFoundException,
        );

        prisma.project.findUnique.mockResolvedValue({ image: 'key' } as never);
        storage.get.mockResolvedValue(null);
        await expect(service.getImage(1, 5)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('is a 404 for someone who cannot see the project', async () => {
        prisma.project.findFirst.mockResolvedValue(null);

        await expect(service.getImage(1, 5)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(storage.get).not.toHaveBeenCalled();
      });
    });

    it('deletes the picture together with the project', async () => {
      owned();
      prisma.project.findUnique.mockResolvedValue({ image: 'key' } as never);

      await service.remove(1, 5);

      expect(prisma.project.delete).toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledWith('key');
    });
  });
});
