import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import {
  LOCK_MS,
  MAX_FAILED_LOGINS,
  UsersService,
  userSelect,
} from './users.service';

describe('UsersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma, { bcryptRounds: 4 } as AppConfigService);
    // The interactive transaction runs its callback against the same mocked client.
    prisma.$transaction.mockImplementation(((
      work: (tx: unknown) => Promise<unknown>,
    ) => work(prisma)) as never);
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

    it('ends every session when the password changes, in the same transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({
        password: await bcrypt.hash('right-password', 4),
      } as never);
      prisma.user.update.mockResolvedValue({} as never);

      await service.updateProfile(1, {
        currentPassword: 'right-password',
        newPassword: 'brand-new-password',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        passwordChangedAt: expect.any(Date),
      });
    });

    it('keeps the sessions when only the name changes', async () => {
      prisma.user.update.mockResolvedValue({} as never);

      await service.updateProfile(1, { name: 'New name' });

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user vanished', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile(1, { currentPassword: 'a', newPassword: 'b' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('verifyPassword', () => {
    it('accepts the right password and refuses a wrong one', async () => {
      const hash = await bcrypt.hash('right', 4);

      expect(await service.verifyPassword('right', hash)).toBe(true);
      expect(await service.verifyPassword('wrong', hash)).toBe(false);
    });

    it('refuses everything when there is no account, but still does the work of a comparison', async () => {
      expect(await service.verifyPassword('anything', null)).toBe(false);

      // The throwaway hash was built and compared against, so an unknown email costs a real bcrypt run.
      expect(
        (service as unknown as { dummyHash?: Promise<string> }).dummyHash,
      ).toBeDefined();
    });
  });

  describe('failed sign-ins', () => {
    it('counts a failure without locking below the limit', async () => {
      prisma.user.update.mockResolvedValue({
        failedLoginAttempts: MAX_FAILED_LOGINS - 1,
      } as never);

      expect(await service.recordFailedLogin(4)).toBe(false);

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        failedLoginAttempts: { increment: 1 },
      });
    });

    it('locks the account for 15 minutes at the limit and starts counting again afterwards', async () => {
      prisma.user.update.mockResolvedValueOnce({
        failedLoginAttempts: MAX_FAILED_LOGINS,
      } as never);
      prisma.user.update.mockResolvedValueOnce({} as never);
      const before = Date.now();

      expect(await service.recordFailedLogin(4)).toBe(true);

      const { data } = prisma.user.update.mock.calls[1][0];
      expect(data.failedLoginAttempts).toBe(0);
      const lockedUntil = (data.lockedUntil as Date).getTime();
      expect(lockedUntil).toBeGreaterThanOrEqual(before + LOCK_MS);
      expect(lockedUntil).toBeLessThan(before + LOCK_MS + 5_000);
    });

    it('forgets the failures after a good sign-in', async () => {
      await service.clearFailedLogins(4);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 4 }),
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });

  describe('applyNewPassword', () => {
    it('sets the hash, lifts a lock and ends all sessions', async () => {
      await service.applyNewPassword(prisma, 7, 'new-hash');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          password: 'new-hash',
          passwordChangedAt: expect.any(Date),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 7, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('also confirms the email address when the reset link proves it', async () => {
      await service.applyNewPassword(prisma, 7, 'new-hash', {
        proveEmail: true,
      });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 7, emailVerifiedAt: null },
        data: { emailVerifiedAt: expect.any(Date) },
      });
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
