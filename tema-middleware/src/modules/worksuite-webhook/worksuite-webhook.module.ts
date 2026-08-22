import { Module } from '@nestjs/common';
import { ContractorsModule } from '../contractors/contractors.module';
import { WorksuiteWebhookController } from './worksuite-webhook.controller';
import { WorksuiteWebhookService } from './worksuite-webhook.service';

/**
 * WorkSuite webhook module. Wires the public webhook controller to the
 * orchestration service, which reuses the global IdempotencyService and
 * AuditService and the contractor domain (ContractorsModule).
 */
@Module({
  imports: [ContractorsModule],
  controllers: [WorksuiteWebhookController],
  providers: [WorksuiteWebhookService],
})
export class WorksuiteWebhookModule {}
