import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // getOrThrow: the app must not start without a secret.
      secretOrKey: configService.getOrThrow<string>('SECRET_KEY'),
    });
  }

  validate(payload: { sub: number; email: string }): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
