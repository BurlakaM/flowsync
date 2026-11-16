import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Writes the OpenAPI document to a file (default: openapi.json) without a database:
 * Nest starts in preview mode, so providers are not instantiated. Run it through
 * `npm run openapi:export`, which builds first so that the Swagger CLI plugin has described the DTOs.
 */
async function exportOpenApi(): Promise<void> {
  // The environment is validated when AppModule is imported, hence the placeholders and the
  // dynamic imports below (static imports would run before these assignments).
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/openapi';
  process.env.JWT_SECRET ??= 'openapi-export';
  process.env.LOG_LEVEL = 'silent';

  const { AppModule } = await import('./app.module');
  const { buildOpenApiDocument } = await import('./swagger');

  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api');

  const target = resolve(process.argv[2] ?? 'openapi.json');
  writeFileSync(
    target,
    `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`,
  );
  console.log(`OpenAPI document written to ${target}`);
  await app.close();
}

void exportOpenApi();
