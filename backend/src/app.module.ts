import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { resolveRequestId } from './common/request-id';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma.module';
import { EventsModule } from './common/events/events.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthModule } from './health/health.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TagsModule } from './modules/tags/tags.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: resolveRequestId,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          // Health checks run every few seconds and would drown the real traffic.
          autoLogging: {
            ignore: (req) => req.url?.endsWith('/health') ?? false,
          },
          ...(config.isDevelopment && {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true },
            },
          }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        errorMessage: 'Too many requests, please try again later',
        // Tests make many requests from one IP; the limits are checked by hand (see the plan).
        skipIf: () => config.isTest,
      }),
    }),
    PrismaModule,
    EventsModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    TagsModule,
    ActivityModule,
    NotificationsModule,
    RealtimeModule,
    HealthModule,
  ],
  providers: [
    // Filters registered later take precedence: the Prisma filter is checked before the catch-all.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    // Guards run in this order: rate limit -> authentication -> roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
