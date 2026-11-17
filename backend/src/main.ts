import './config/instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfigService } from './config/app-config.service';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(AppConfigService);
  // With Redis, live updates reach the sockets of every API instance, not only of the one that handled the event.
  if (config.redisUrl) {
    const adapter = new RedisIoAdapter(app, config.redisUrl);
    adapter.connect();
    app.useWebSocketAdapter(adapter);
  }
  if (!config.isProduction) setupSwagger(app);

  await app.listen(config.port);
}
void bootstrap();
