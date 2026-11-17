import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import {
  RESEND_COOLDOWN_MS,
  TOKEN_TTL_MS,
  UserTokensService,
} from './user-tokens.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('UserTokensService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UserTokensService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(((work: unknown) =>
      typeof work === 'function'
        ? (work as (tx: unknown) => unknown)(prisma)
        : Promise.all(work as Promise<unknown>[])) as never);
    service = new UserTokensService(prisma);
  });

  describe('issue', () => {
    it('stores only the hash of the token and returns the raw one', async () => {
      const token = await service.issue(4, 'PASSWORD_RESET');

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const { data } = prisma.userToken.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(sha256(token));
      expect(JSON.stringify(data)).not.toContain(token);
    });

    it('lets a reset link live for an hour and a confirmation link for a day', async () => {
      const before = Date.now();
      await service.issue(4, 'PASSWORD_RESET');
      await service.issue(4, 'EMAIL_VERIFICATION');

      const expires = (call: number) =>
        (
          prisma.userToken.create.mock.calls[call][0].data.expiresAt as Date
        ).getTime() - before;
      expect(expires(0)).toBeGreaterThanOrEqual(TOKEN_TTL_MS.PASSWORD_RESET);
      expect(expires(0)).toBeLessThan(TOKEN_TTL_MS.PASSWORD_RESET + 5_000);
      expect(expires(1)).toBeGreaterThanOrEqual(
        TOKEN_TTL_MS.EMAIL_VERIFICATION,
      );
    });

    it('cancels the earlier unused links of the same kind', async () => {
      await service.issue(4, 'PASSWORD_RESET');

      expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 4, type: 'PASSWORD_RESET', usedAt: null },
      });
    });

    it('issues a different token every time', async () => {
      const [a, b] = [
        await service.issue(4, 'PASSWORD_RESET'),
        await service.issue(4, 'PASSWORD_RESET'),
      ];

      expect(a).not.toBe(b);
    });
  });

  describe('consume', () => {
    const row = (overrides: object = {}) => ({
      id: 9,
      userId: 4,
      type: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    });

    it('spends a valid token and returns its owner', async () => {
      prisma.userToken.findUnique.mockResolvedValue(row() as never);
      prisma.userToken.updateMany.mockResolvedValue({ count: 1 });

      expect(await service.consume('raw', 'PASSWORD_RESET')).toBe(4);
      expect(prisma.userToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw') },
      });
    });

    it.each([
      ['an unknown token', null],
      ['a spent token', row({ usedAt: new Date() })],
      ['an expired token', row({ expiresAt: new Date(Date.now() - 1) })],
      ['a token of another kind', row({ type: 'EMAIL_VERIFICATION' })],
    ])(
      'refuses %s with the same message as any other bad link',
      async (_name, found) => {
        prisma.userToken.findUnique.mockResolvedValue(found as never);

        await expect(service.consume('raw', 'PASSWORD_RESET')).rejects.toThrow(
          new BadRequestException('The link is invalid or has expired'),
        );
        expect(prisma.userToken.updateMany).not.toHaveBeenCalled();
      },
    );

    it('lets only one of two parallel requests use a token', async () => {
      prisma.userToken.findUnique.mockResolvedValue(row() as never);
      prisma.userToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.consume('raw', 'PASSWORD_RESET'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('redeem', () => {
    it('runs the change in the transaction that spends the token', async () => {
      prisma.userToken.findUnique.mockResolvedValue({
        id: 9,
        userId: 4,
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      } as never);
      prisma.userToken.updateMany.mockResolvedValue({ count: 1 });
      const work = vi.fn().mockResolvedValue(undefined);

      await service.redeem('raw', 'PASSWORD_RESET', work);

      expect(work).toHaveBeenCalledWith(4, prisma);
    });

    it('does not run the change for a bad token', async () => {
      prisma.userToken.findUnique.mockResolvedValue(null);
      const work = vi.fn();

      await expect(
        service.redeem('raw', 'PASSWORD_RESET', work),
      ).rejects.toThrow();
      expect(work).not.toHaveBeenCalled();
    });
  });

  describe('issuedRecently', () => {
    it('looks for a token created within the cooldown', async () => {
      prisma.userToken.count.mockResolvedValue(1);

      expect(await service.issuedRecently(4, 'PASSWORD_RESET')).toBe(true);

      const { where } = prisma.userToken.count.mock.calls[0][0] ?? {};
      const since = (where?.createdAt as { gt: Date }).gt.getTime();
      expect(Date.now() - since).toBeGreaterThanOrEqual(RESEND_COOLDOWN_MS - 5);
    });

    it('is false when none was', async () => {
      prisma.userToken.count.mockResolvedValue(0);

      expect(await service.issuedRecently(4, 'PASSWORD_RESET')).toBe(false);
    });
  });
});
