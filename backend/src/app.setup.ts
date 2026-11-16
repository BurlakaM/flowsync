import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Used when CORS_ORIGINS is not set: the local frontends (docker, CRA, Vite).
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:3001',
  'http://localhost:5173',
];

/** Shared by main.ts and e2e tests so that tests run against the real configuration. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = config
    .get<string>('CORS_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : DEFAULT_CORS_ORIGINS });
}
