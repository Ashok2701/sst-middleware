import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { SERVICE_NAME } from './common/constants';

/** Path (relative to the app root) where Swagger UI is served. */
export const SWAGGER_PATH = 'docs';

/**
 * Builds the OpenAPI document for the CURRENTLY implemented API surface only
 * (health, readiness, version). No future/integration endpoints are invented.
 *
 * Reused by both the runtime Swagger UI and the `openapi:generate` script so
 * the served docs and the exported `openapi.json` never drift apart.
 */
export function createOpenApiDocument(
  app: INestApplication,
  version: string,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TEMA Middleware API')
    .setDescription(
      'Enterprise integration middleware platform. Phase 1.5: foundation only ' +
        '(health, readiness, version). External integrations (FSM, FSM Scheduler, ' +
        'Sage X3, SQL, WorkSuite, Lead Perfection) are NOT implemented yet.',
    )
    .setVersion(version)
    .addTag('Health', 'Liveness and readiness probes')
    .addTag('Version', 'Service version information')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Mounts interactive Swagger UI at `/docs` (and JSON at `/docs-json`).
 * Only called when Swagger is enabled for the current environment.
 */
export function setupSwagger(app: INestApplication, version: string): void {
  const document = createOpenApiDocument(app, version);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: `${SERVICE_NAME} API docs`,
    swaggerOptions: { displayRequestDuration: true },
  });
}
