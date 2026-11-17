import { UnauthorizedException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    strategy = new JwtStrategy(
      { jwtSecret: 'test-secret' } as AppConfigService,
      prisma,
    );
  });

  it('attaches id, email and role of the token owner to the request', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      email: 'a@b.co',
      role: 'ADMIN',
    } as never);

    expect(await strategy.validate({ sub: 3, email: 'a@b.co' })).toEqual({
      id: 3,
      email: 'a@b.co',
      role: 'ADMIN',
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 99, email: 'gone@example.test' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('a password change ends the sessions that existed before it', () => {
    const changedAt = new Date('2026-06-01T12:00:00.000Z');
    const seconds = Math.floor(changedAt.getTime() / 1000);
    const user = {
      id: 3,
      email: 'a@b.co',
      role: 'USER',
      passwordChangedAt: changedAt,
    };

    it('rejects an access token issued before the change', async () => {
      prisma.user.findUnique.mockResolvedValue(user as never);

      await expect(
        strategy.validate({ sub: 3, email: 'a@b.co', iat: seconds - 1 }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a token issued at or after the change', async () => {
      prisma.user.findUnique.mockResolvedValue(user as never);

      await expect(
        strategy.validate({ sub: 3, email: 'a@b.co', iat: seconds }),
      ).resolves.toMatchObject({ id: 3 });
      await expect(
        strategy.validate({ sub: 3, email: 'a@b.co', iat: seconds + 60 }),
      ).resolves.toMatchObject({ id: 3 });
    });

    it('does not expose the change date to the request', async () => {
      prisma.user.findUnique.mockResolvedValue(user as never);

      expect(
        await strategy.validate({ sub: 3, email: 'a@b.co', iat: seconds }),
      ).toEqual({ id: 3, email: 'a@b.co', role: 'USER' });
    });
  });
});
