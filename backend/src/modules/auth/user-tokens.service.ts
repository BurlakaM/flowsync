import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserTokenType } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';

/** How long a link from an email works. A reset link is short-lived on purpose: it is a password. */
export const TOKEN_TTL_MS: Record<UserTokenType, number> = {
  PASSWORD_RESET: 60 * 60 * 1000,
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
};

/** One email of a kind per user per this long: stops the form from being used to flood a mailbox. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

type Db = PrismaService | Prisma.TransactionClient;

/**
 * One-time secrets for links sent by email. The raw token exists only in the email; the database keeps
 * its SHA-256 hash (like refresh tokens), so reading the table does not let anyone reset a password.
 */
@Injectable()
export class UserTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token and invalidates the user's earlier unused ones of the same kind. Returns the raw token. */
  async issue(userId: number, type: UserTokenType): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({
        where: { userId, type, usedAt: null },
      }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /**
   * Spends the token and runs `work` in the same transaction: either the token is used up and the change
   * is made, or neither happens (a failure must not burn a one-hour reset link).
   */
  redeem(
    token: string,
    type: UserTokenType,
    work: (userId: number, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const userId = await this.consume(token, type, tx);
      await work(userId, tx);
    });
  }

  /** True when a token of this kind was issued to the user a moment ago. */
  async issuedRecently(userId: number, type: UserTokenType): Promise<boolean> {
    const count = await this.prisma.userToken.count({
      where: {
        userId,
        type,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
    });
    return count > 0;
  }

  /**
   * Spends a token and returns whose it was. Pass the transaction of the change the token authorises, so
   * that the token is used up only if the change is made. Unknown, spent and expired tokens look the same.
   */
  async consume(
    token: string,
    type: UserTokenType,
    db: Db = this.prisma,
  ): Promise<number> {
    const row = await db.userToken.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (
      !row ||
      row.type !== type ||
      row.usedAt ||
      row.expiresAt.getTime() <= Date.now()
    ) {
      throw invalid();
    }
    // "Use once" even when two requests race: only one of them updates the row.
    const { count } = await db.userToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw invalid();
    return row.userId;
  }
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const invalid = () =>
  new BadRequestException('The link is invalid or has expired');
