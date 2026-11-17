import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

// Fields that are safe to return to clients. Never add `password` here.
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** After this many wrong passwords in a row the account is locked for LOCK_MS. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** The role is never set here: the schema default (USER) applies. */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await this.hashPassword(dto.password);
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hashedPassword },
      select: userSelect,
    });
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Compares a password with a stored hash. With no hash (unknown email) it still does a full bcrypt
   * comparison against a throwaway one, so the response time does not reveal which emails have accounts.
   */
  async verifyPassword(
    password: string,
    hash: string | null,
  ): Promise<boolean> {
    this.dummyHash ??= bcrypt.hash(
      'not-a-real-password',
      this.config.bcryptRounds,
    );
    const valid = await bcrypt.compare(
      password,
      hash ?? (await this.dummyHash),
    );
    return hash !== null && valid;
  }

  /**
   * Counts a wrong password and locks the account at the limit. The increment is one atomic statement, so
   * parallel guesses cannot slip past the limit. Returns true when this attempt locked the account.
   */
  async recordFailedLogin(id: number): Promise<boolean> {
    const { failedLoginAttempts } = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts < MAX_FAILED_LOGINS) return false;

    await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + LOCK_MS),
      },
    });
    this.logger.warn(
      `Account ${id} locked for ${LOCK_MS / 60_000} minutes after ${MAX_FAILED_LOGINS} failed sign-ins`,
    );
    return true;
  }

  async clearFailedLogins(id: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: {
        id,
        OR: [
          { failedLoginAttempts: { gt: 0 } },
          { lockedUntil: { not: null } },
        ],
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  /**
   * Sets a new password and ends every session of the user, in the caller's transaction: a stolen
   * refresh token must not outlive the password that was changed because of the theft. Access tokens
   * issued before this moment are refused too (see JwtStrategy). `proveEmail` is for the reset link,
   * which shows that the owner reads the mailbox.
   */
  async applyNewPassword(
    tx: Prisma.TransactionClient,
    id: number,
    passwordHash: string,
    options: { proveEmail?: boolean } = {},
  ): Promise<void> {
    const now = new Date();
    await tx.user.update({
      where: { id },
      data: {
        password: passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    if (options.proveEmail) await this.markEmailVerified(tx, id);
    await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async markEmailVerified(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<void> {
    await tx.user.updateMany({
      where: { id, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async getProfile(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Changing the password requires the current one, and ends every session (including this one: the
   * client signs in again with the new password).
   */
  async updateProfile(
    id: number,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    let newHash: string | undefined;
    if (dto.newPassword !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { password: true },
      });
      if (!user) throw new NotFoundException('User not found');

      const isCurrentValid = await this.verifyPassword(
        dto.currentPassword ?? '',
        user.password,
      );
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }
      newHash = await this.hashPassword(dto.newPassword);
    }

    return this.prisma.$transaction(async (tx) => {
      if (newHash !== undefined) await this.applyNewPassword(tx, id, newHash);
      return tx.user.update({
        where: { id },
        data: dto.name !== undefined ? { name: dto.name } : {},
        select: userSelect,
      });
    });
  }

  async list(query: QueryUsersDto): Promise<Page<UserResponseDto>> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  /**
   * Internal use only (login): returns the password hash.
   * Never return the result of this method from a controller.
   */
  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
