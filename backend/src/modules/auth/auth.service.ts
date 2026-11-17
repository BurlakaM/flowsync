import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { passwordResetEmail, verificationEmail } from './auth-emails';
import { LoginDto } from './dto/login.dto';
import { RefreshTokensService } from './refresh-tokens.service';
import { UserTokensService } from './user-tokens.service';

interface TokenSubject {
  id: number;
  email: string;
}

/** What a sign-in produces: a short-lived access token and the refresh token that renews it. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly userTokens: UserTokensService,
    private readonly mailQueue: MailQueueService,
    private readonly config: AppConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.createUser(dto);
    await this.sendVerification(user.id, user.email);
    return user;
  }

  me(userId: number) {
    return this.usersService.getProfile(userId);
  }

  /**
   * Returns the user (without the password hash) when the credentials are valid.
   *
   * Brute force is slowed in three layers: a per-IP rate limit (controller), a lock on the account after
   * repeated failures (here), and bcrypt itself. A locked account answers 429 even for the right password.
   * The lock can be used to annoy someone (15 minutes, by anyone who knows the email); that is the usual
   * price, and the reset-password link ends a lock at once.
   */
  async validateUser(dto: LoginDto): Promise<TokenSubject | null> {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        'Too many failed sign-in attempts. Try again later or reset your password',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      dto.password,
      user?.password ?? null,
    );
    if (!user) return null;
    if (!isPasswordValid) {
      await this.usersService.recordFailedLogin(user.id);
      return null;
    }

    await this.usersService.clearFailedLogins(user.id);
    return { id: user.id, email: user.email };
  }

  /** Signs in: a new family of refresh tokens starts. */
  async login(user: TokenSubject): Promise<Session> {
    const refresh = await this.refreshTokens.issue(user.id);
    return this.toSession(user, refresh);
  }

  /** Exchanges a refresh token for a new pair; the old token is spent (rotation). */
  async refresh(token: string): Promise<Session> {
    const { userId, familyId } = await this.refreshTokens.consume(token);
    const user = await this.usersService.getProfile(userId);
    const refresh = await this.refreshTokens.issue(userId, familyId);
    return this.toSession(user, refresh);
  }

  logout(token: string): Promise<void> {
    return this.refreshTokens.revokeByToken(token);
  }

  /**
   * Emails a reset link. It answers the same whether the address has an account or not: otherwise the form
   * would tell anyone which emails are registered.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmailForAuth(email);
    if (!user) return;
    if (await this.userTokens.issuedRecently(user.id, 'PASSWORD_RESET')) return;

    const token = await this.userTokens.issue(user.id, 'PASSWORD_RESET');
    await this.mailQueue.enqueue({
      to: user.email,
      ...passwordResetEmail(this.config.appUrl, token),
    });
  }

  /**
   * Sets a new password with a link from the email. Every session ends and a lock is lifted; reading the
   * mailbox also proves the address.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    // Hashing first keeps the time of a valid and an invalid token alike.
    const hash = await this.usersService.hashPassword(password);
    await this.userTokens.redeem(token, 'PASSWORD_RESET', (userId, tx) =>
      this.usersService.applyNewPassword(tx, userId, hash, {
        proveEmail: true,
      }),
    );
  }

  async verifyEmail(token: string): Promise<void> {
    await this.userTokens.redeem(token, 'EMAIL_VERIFICATION', (userId, tx) =>
      this.usersService.markEmailVerified(tx, userId),
    );
  }

  /** Sends the confirmation link again. Quietly does nothing when the address is confirmed or a link was just sent. */
  async resendVerification(userId: number): Promise<void> {
    const user = await this.usersService.getProfile(userId);
    if (user.emailVerifiedAt) return;
    if (await this.userTokens.issuedRecently(userId, 'EMAIL_VERIFICATION'))
      return;
    await this.sendVerification(userId, user.email);
  }

  /** Never fails the request that triggered it: a lost email can be asked for again. */
  private async sendVerification(userId: number, email: string): Promise<void> {
    try {
      const token = await this.userTokens.issue(userId, 'EMAIL_VERIFICATION');
      await this.mailQueue.enqueue({
        to: email,
        ...verificationEmail(this.config.appUrl, token),
      });
    } catch (error) {
      this.logger.error(
        `Could not send the verification email to user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toSession(
    user: TokenSubject,
    refresh: { token: string; expiresAt: Date },
  ): Session {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}
