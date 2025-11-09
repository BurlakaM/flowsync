import { Module } from '@nestjs/common';
import { TasksModule } from './tasks/tasks.module';
import { NestModule, MiddlewareConsumer } from '@nestjs/common';
import {LoggerMiddleware} from "./conception/middleware";
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './users/users.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: '.env',
    isGlobal: true
  }),
    TasksModule, AuthModule, UserModule, CommentsModule ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('tasks');
  }
}

