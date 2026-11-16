import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mockDeep } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { RefreshTokensService } from './refresh-tokens.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('RefreshTokensService', () => {
  const prisma = mockDeep<PrismaService>();
  const config = {
    refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
  } as AppConfigService;
  let service: RefreshTokensService;

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    userId: 9,
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((operations) =>
      Promise.all(operations as unknown as Promise<unknown>[]),
    );
    service = new RefreshTokensService(prisma, config);
  });

  describe('issue', () => {
    it('stores only the hash of a fresh random token', async () => {
      const { token, expiresAt } = await service.issue(9, 'family-1');

      expect(token.length).toBeGreaterThanOrEqual(64);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: sha256(token),
          familyId: 'family-1',
          userId: 9,
          expiresAt,
        },
      });
      const data = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(JSON.stringify(data)).not.toContain(token);
    });

    it('starts a new family when none is given and expires after the configured time', async () => {
      const before = Date.now();
      const { expiresAt } = await service.issue(9);

      const family = prisma.refreshToken.create.mock.calls[0][0].data.familyId;
      expect(family).toMatch(/^[0-9a-f-]{36}$/);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + config.refreshTokenTtlMs,
      );
    });

    it('removes expired tokens of the same user', async () => {
      await service.issue(9);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 9, expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('consume', () => {
    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.consume('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('looks the token up by its hash', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await service.consume('secret').catch(() => undefined);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('secret') },
      });
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        row({ expiresAt: new Date(Date.now() - 1) }) as never,
      );

      await expect(service.consume('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('spends a valid token and returns its owner and family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(row() as never);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      expect(await service.consume('t')).toEqual({
        userId: 9,
        familyId: 'family-1',
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects the loser of two concurrent uses without touching the family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(row() as never);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.consume('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });

    it('revokes the whole family when a spent token is replayed later', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        row({ revokedAt: new Date(Date.now() - 60_000) }) as never,
      );
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.consume('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('tolerates a token spent a moment ago (two tabs refreshing together)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        row({ revokedAt: new Date(Date.now() - 1_000) }) as never,
      );

      await expect(service.consume('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('revokeByToken', () => {
    it('revokes the family of a known token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        familyId: 'family-1',
      } as never);

      await service.revokeByToken('t');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('ignores an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.revokeByToken('t')).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
