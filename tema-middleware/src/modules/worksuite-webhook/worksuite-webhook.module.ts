import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractorsModule } from '../contractors/contractors.module';
import {
  createWebhookAuthenticator,
  WEBHOOK_AUTHENTICATOR,
} from './auth/webhook-authenticator';
import { WorksuiteWebhookController } from './worksuite-webhook.controller';
import { WorksuiteWebhookService } from './worksuite-webhook.service';

/**
 * WorkSuite webhook module. Wires the public webhook controller to the
 * orchestration service, which reuses the global IdempotencyService and
 * AuditService and the contractor domain (ContractorsModule). The webhook
 * authenticator is pluggable (selected by config); default is TEMPORARY HMAC.
 */
@Module({
  imports: [ContractorsModule],
  controllers: [WorksuiteWebhookController],
  providers: [
    WorksuiteWebhookService,
    {
      provide: WEBHOOK_AUTHENTICATOR,
      useFactory: (config: ConfigService) => createWebhookAuthenticator(config),
      inject: [ConfigService],
    },
  ],
})
export class WorksuiteWebhookModule {}
