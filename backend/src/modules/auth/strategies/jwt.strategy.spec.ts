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
      role: { name: 'admin' },
    } as never);

    expect(await strategy.validate({ sub: 3, email: 'a@b.co' })).toEqual({
      id: 3,
      email: 'a@b.co',
      role: 'admin',
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 99, email: 'gone@example.test' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
