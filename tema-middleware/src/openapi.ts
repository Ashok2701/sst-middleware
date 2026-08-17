import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { DEFAULT_VERSION } from './common/constants';
import { createOpenApiDocument } from './swagger';

/**
 * Reproducibly generates `openapi.json` from the live application metadata.
 *
 * The output reflects ONLY the endpoints that currently exist. Run with:
 *   npm run openapi:generate
 */
async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const version = process.env.npm_package_version ?? DEFAULT_VERSION;
  const document = createOpenApiDocument(app, version);

  const outputPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI specification written to ${outputPath}`);
}

generateOpenApi().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate OpenAPI specification:', error);
  process.exit(1);
});
