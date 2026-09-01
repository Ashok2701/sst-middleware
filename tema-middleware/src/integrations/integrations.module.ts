import { Module } from '@nestjs/common';
import { IntegrationHealthController } from './integration-health.controller';
import { IntegrationRegistry } from './integration-registry.service';
import { LeadPerfectionModule } from './lead-perfection/lead-perfection.module';
import { SageX3Module } from './sage-x3/sage-x3.module';
import { SqlServerModule } from './sql-server/sql-server.module';
import { WorksuiteModule } from './worksuite/worksuite.module';

/**
 * Aggregates all backend-system integrations. Each integration is a module
 * under this folder; adding a future adapter (FSM, FSM Scheduler) means adding
 * its module here - no core changes.
 */
@Module({
  imports: [
    SqlServerModule,
    SageX3Module,
    WorksuiteModule,
    LeadPerfectionModule,
  ],
  controllers: [IntegrationHealthController],
  providers: [IntegrationRegistry],
  exports: [
    IntegrationRegistry,
    SqlServerModule,
    SageX3Module,
    WorksuiteModule,
    LeadPerfectionModule,
  ],
})
export class IntegrationsModule {}
