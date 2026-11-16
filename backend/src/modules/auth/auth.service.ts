import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokensService } from './refresh-tokens.service';

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
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  register(dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  me(userId: number) {
    return this.usersService.getProfile(userId);
  }

  /** Returns the user (without the password hash) when the credentials are valid. */
  async validateUser(dto: LoginDto): Promise<TokenSubject | null> {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user) return null;
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) return null;
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
