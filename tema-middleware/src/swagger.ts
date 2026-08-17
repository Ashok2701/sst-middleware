import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { SERVICE_NAME } from './common/constants';

/** Path (relative to the app root) where Swagger UI is served. */
export const SWAGGER_PATH = 'docs';

/**
 * Configures interactive OpenAPI / Swagger documentation.
 *
 * Only the public API surface is documented; internal implementation details
 * are not exposed.
 */
export function setupSwagger(app: INestApplication, version: string): void {
  const config = new DocumentBuilder()
    .setTitle('TEMA Middleware API')
    .setDescription(
      'Enterprise integration middleware platform. Phase 1: foundation only ' +
        '(health, readiness, version). External integrations are not yet implemented.',
    )
    .setVersion(version)
    .addTag('Health', 'Liveness and readiness probes')
    .addTag('Version', 'Service version information')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: `${SERVICE_NAME} API docs`,
    swaggerOptions: { displayRequestDuration: true },
  });
}
