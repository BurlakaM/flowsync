import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../database/prisma.service';

interface JwtPayload {
  sub: number;
  email: string;
  /** Seconds since the epoch, added by the signer. */
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  /** Runs for every authenticated request: a token of a deleted user, or issued before a password change, is rejected right away. */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException();

    // A password change or reset ends the sessions that existed before it, not only the refresh tokens:
    // an access token stolen earlier must not stay usable for the rest of its 15 minutes. `iat` has
    // one-second resolution, so tokens of the same second as the change are still accepted.
    if (
      user.passwordChangedAt &&
      (payload.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException();
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
