import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * A token that was spent a moment ago may legitimately arrive again: two browser tabs refresh at once
 * and the second request carries the cookie that the first one has just replaced. Only a later reuse
 * is treated as theft.
 */
const REUSE_GRACE_MS = 10_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** Rotating refresh tokens: every token is used once, and a replay revokes the whole sign-in (family). */
@Injectable()
export class RefreshTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** Starts a new family, or continues the given one after a rotation. */
  async issue(
    userId: number,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenTtlMs);

    await this.prisma.$transaction([
      // Housekeeping: expired rows of this user are useless, so the table does not grow without bound.
      this.prisma.refreshToken.deleteMany({
        where: { userId, expiresAt: { lt: now } },
      }),
      this.prisma.refreshToken.create({
        data: { tokenHash: hash(token), familyId, userId, expiresAt },
      }),
    ]);
    return { token, expiresAt };
  }

  /** Spends a valid token and returns whose it was; the caller then issues the next one in the same family. */
  async consume(token: string): Promise<{ userId: number; familyId: string }> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!row) throw invalid();

    if (row.revokedAt) {
      if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.revokeFamily(row.familyId);
      }
      throw invalid();
    }
    if (row.expiresAt.getTime() <= Date.now()) throw invalid();

    // Atomic "use once": of two concurrent requests with the same token only one updates the row.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw invalid();

    return { userId: row.userId, familyId: row.familyId };
  }

  /** Ends the sign-in the token belongs to. Unknown tokens are ignored: logging out never fails. */
  async revokeByToken(token: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(token) },
      select: { familyId: true },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const invalid = () => new UnauthorizedException('Invalid refresh token');
