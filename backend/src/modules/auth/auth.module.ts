import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../../config/app-config.service';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserTokensService } from './user-tokens.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: config.jwtExpiresIn as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    RefreshTokensService,
    UserTokensService,
    JwtStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
