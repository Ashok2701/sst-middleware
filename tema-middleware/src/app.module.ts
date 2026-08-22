import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './common/auth/auth.module';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { CorrelationMiddleware } from './common/correlation/correlation.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { IntegrationCoreModule } from './common/integration/integration-core.module';
import { LoggingModule } from './common/logging/logging.module';
import { RateLimitModule } from './common/ratelimit/rate-limit.module';
import { SecurityModule } from './common/security/security.module';
import { createValidationPipe } from './common/validation/validation.pipe';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { WorksuiteWebhookModule } from './modules/worksuite-webhook/worksuite-webhook.module';
import { VersionModule } from './version/version.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggingModule,
    // Phase 2 foundations (global): reliability, audit, security, protection.
    IntegrationCoreModule,
    AuditModule,
    SecurityModule,
    RateLimitModule,
    // Phase 3.1 authentication foundation (global guard; no-op when disabled).
    AuthModule,
    // Phase 3.2 authorization/RBAC (global guard; runs after authentication).
    AuthorizationModule,
    // Feature modules.
    HealthModule,
    VersionModule,
    IntegrationsModule,
    // Phase 3.3 first business API.
    TechniciansModule,
    // Phase 3.4 WorkSuite contractor integration foundation.
    WorksuiteWebhookModule,
  ],
  providers: [
    // Global, consistent error handling for every route.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Global request validation - foundation for all future DTOs.
    { provide: APP_PIPE, useValue: createValidationPipe() as ValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
