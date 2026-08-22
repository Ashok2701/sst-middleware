import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap(): Promise<void> {
  // `rawBody: true` preserves req.rawBody (used for WorkSuite webhook HMAC
  // verification) WITHOUT disabling normal JSON parsing for other routes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Route all Nest framework logs through pino (structured logging).
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8081;
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  const swaggerEnabled = config.get<boolean>('swaggerEnabled') ?? false;
  const version = process.env.npm_package_version ?? '0.1.0';

  // Interactive API docs - only mounted when enabled for this environment.
  if (swaggerEnabled) {
    setupSwagger(app, version);
  }

  // Graceful shutdown support for container orchestration.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `TEMA Middleware started (env=${nodeEnv}) on port ${port} - ` +
      (swaggerEnabled ? `docs at /${SWAGGER_PATH}` : 'Swagger disabled'),
    'Bootstrap',
  );
}

bootstrap();
