import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AppConfigService } from '../../config/app-config.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService, Session } from './auth.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from './refresh-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  // Public: sign-up. Limited to 5 requests per minute per IP.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: UserResponseDto })
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  // Public: this is how a user gets a token. Limited to 5 attempts per minute per IP.
  // The access token is in the body (the client keeps it in memory); the refresh token is an httpOnly cookie.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const user = await this.authService.validateUser(loginDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.startSession(response, await this.authService.login(user));
  }

  // Public: the refresh cookie itself is the credential (httpOnly, SameSite=Strict, scoped to /api/auth).
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const token = this.refreshTokenOf(request);
    if (!token) throw new UnauthorizedException('Missing refresh token');

    try {
      return this.startSession(response, await this.authService.refresh(token));
    } catch (error) {
      // A rejected cookie is useless: drop it so the browser stops sending it.
      clearRefreshCookie(response, this.config.cookieSecure);
      throw error;
    }
  }

  // Public: ends the sign-in behind the cookie. It never fails, so the client can always call it.
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.refreshTokenOf(request);
    if (token) await this.authService.logout(token);
    clearRefreshCookie(response, this.config.cookieSecure);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private startSession(response: Response, session: Session): LoginResponseDto {
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
      this.config.cookieSecure,
    );
    return { access_token: session.accessToken };
  }

  private refreshTokenOf(request: Request): string | undefined {
    const value: unknown = request.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
