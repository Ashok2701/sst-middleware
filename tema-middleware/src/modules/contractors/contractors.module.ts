import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { CONTRACTOR_STORE, InMemoryContractorStore } from './contractor-store';
import { ContractorsService } from './contractors.service';
import { ContractorInitialLoadService } from './initial-load.service';
import { ContractorMapper } from './mappers/contractor.mapper';
import { WorksuitePasswordVerifier } from './password/password-verifier';

/**
 * Contractor domain: canonical model, mapper, pluggable store, sync service,
 * initial-load abstraction and local password verification. Depends on the
 * WorkSuite Partner API adapter (via IntegrationsModule). Audit/idempotency are
 * provided globally.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [
    { provide: CONTRACTOR_STORE, useClass: InMemoryContractorStore },
    ContractorMapper,
    ContractorsService,
    ContractorInitialLoadService,
    WorksuitePasswordVerifier,
  ],
  exports: [
    ContractorsService,
    ContractorMapper,
    WorksuitePasswordVerifier,
    ContractorInitialLoadService,
  ],
})
export class ContractorsModule {}
