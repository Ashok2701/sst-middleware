import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route all Nest framework logs through pino (structured logging).
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8081;
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';

  // Interactive API docs (available in every environment; safe, public surface).
  setupSwagger(app, process.env.npm_package_version ?? '0.1.0');

  // Graceful shutdown support for container orchestration.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `TEMA Middleware started (env=${nodeEnv}) on port ${port} - docs at /${SWAGGER_PATH}`,
    'Bootstrap',
  );
}

bootstrap();
