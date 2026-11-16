import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UsersService, userSelect } from './users.service';

describe('UsersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma, { bcryptRounds: 4 } as AppConfigService);
  });

  describe('createUser', () => {
    const dto = {
      name: 'Ann',
      email: 'ann@example.test',
      password: 'password-123',
    };

    it('stores a bcrypt hash instead of the password', async () => {
      prisma.user.create.mockResolvedValue({} as never);

      await service.createUser(dto);

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, data.password as string)).toBe(
        true,
      );
    });

    it('never sets a role, so the schema default (USER) applies', async () => {
      prisma.user.create.mockResolvedValue({} as never);

      await service.createUser(dto);

      expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty(
        'role',
      );
    });

    it('selects only fields that are safe to return', async () => {
      prisma.user.create.mockResolvedValue({} as never);

      await service.createUser(dto);

      expect(prisma.user.create.mock.calls[0][0].select).toBe(userSelect);
      expect(userSelect).not.toHaveProperty('password');
    });
  });

  describe('getProfile', () => {
    it('throws NotFoundException for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('changes only the name without touching the password', async () => {
      prisma.user.update.mockResolvedValue({} as never);

      await service.updateProfile(1, { name: 'New name' });

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        name: 'New name',
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a new password when the current one is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        password: await bcrypt.hash('right-password', 4),
      } as never);

      await expect(
        service.updateProfile(1, {
          currentPassword: 'wrong-password',
          newPassword: 'brand-new-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('stores the hash of the new password when the current one is right', async () => {
      prisma.user.findUnique.mockResolvedValue({
        password: await bcrypt.hash('right-password', 4),
      } as never);
      prisma.user.update.mockResolvedValue({} as never);

      await service.updateProfile(1, {
        currentPassword: 'right-password',
        newPassword: 'brand-new-password',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.password).not.toBe('brand-new-password');
      expect(
        await bcrypt.compare('brand-new-password', data.password as string),
      ).toBe(true);
    });

    it('throws NotFoundException when the user vanished', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile(1, { currentPassword: 'a', newPassword: 'b' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    const query = (extra: Partial<QueryUsersDto> = {}) =>
      Object.assign(new QueryUsersDto(), { page: 2, limit: 10 }, extra);

    it('paginates and reports the total', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 1 }] as never);
      prisma.user.count.mockResolvedValue(11);

      const page = await service.list(query());

      expect(prisma.user.findMany.mock.calls[0][0]).toMatchObject({
        skip: 10,
        take: 10,
      });
      expect(page.meta).toEqual({
        page: 2,
        limit: 10,
        total: 11,
        totalPages: 2,
      });
    });

    it('searches the name and the email case-insensitively', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ search: 'ann' }));

      expect(prisma.user.findMany.mock.calls[0][0]?.where).toEqual({
        OR: [
          { name: { contains: 'ann', mode: 'insensitive' } },
          { email: { contains: 'ann', mode: 'insensitive' } },
        ],
      });
    });
  });
});
