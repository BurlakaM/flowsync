import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import { UsersService, userSelect } from './users.service';

describe('UsersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma);
  });

  describe('createUser', () => {
    const dto = {
      name: 'Ann',
      email: 'ann@example.test',
      password: 'password-123',
    };

    it('stores a bcrypt hash instead of the password', async () => {
      prisma.role.findFirstOrThrow.mockResolvedValue({ id: 1, name: 'user' });
      prisma.user.create.mockResolvedValue({} as never);

      await service.createUser(dto);

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, data.password as string)).toBe(
        true,
      );
    });

    it('always connects the new user to the default role', async () => {
      prisma.role.findFirstOrThrow.mockResolvedValue({ id: 7, name: 'user' });
      prisma.user.create.mockResolvedValue({} as never);

      await service.createUser(dto);

      expect(prisma.role.findFirstOrThrow).toHaveBeenCalledWith({
        where: { name: 'user' },
      });
      expect(prisma.user.create.mock.calls[0][0].data.role).toEqual({
        connect: { id: 7 },
      });
    });

    it('selects only fields that are safe to return', async () => {
      prisma.role.findFirstOrThrow.mockResolvedValue({ id: 1, name: 'user' });
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
});
