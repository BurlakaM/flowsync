import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { httpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { MetricsService } from './metrics/metrics.service';
import { AppConfigService } from './config/app-config.service';

/** Shared by main.ts and e2e tests so that tests run against the real configuration. */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use(httpMetricsMiddleware(app.get(MetricsService)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.corsOrigins });
  // Lets PrismaService disconnect cleanly on SIGTERM (docker stop).
  app.enableShutdownHooks();

  // Behind nginx every request comes from the proxy; trust it to get the real client IP
  // (needed by the rate limiter).
  if (config.trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxy);
  }
}
