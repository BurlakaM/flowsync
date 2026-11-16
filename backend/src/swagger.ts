import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** The OpenAPI document of the API (paths include the global prefix of the app). */
export function buildOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('FlowSync API')
      .setVersion('0.1')
      .addBearerAuth()
      .build(),
  );
}

/** OpenAPI docs at /api/docs. Only mounted outside production (see main.ts). */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    useGlobalPrefix: true,
  });
}
