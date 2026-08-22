import { Module } from '@nestjs/common';
import { IntegrationHealthController } from './integration-health.controller';
import { IntegrationRegistry } from './integration-registry.service';
import { SageX3Module } from './sage-x3/sage-x3.module';
import { SqlServerModule } from './sql-server/sql-server.module';
import { WorksuiteModule } from './worksuite/worksuite.module';

/**
 * Aggregates all backend-system integrations. Each integration is a module
 * under this folder; adding a future adapter (FSM, FSM Scheduler, Lead
 * Perfection) means adding its module here - no core changes.
 */
@Module({
  imports: [SqlServerModule, SageX3Module, WorksuiteModule],
  controllers: [IntegrationHealthController],
  providers: [IntegrationRegistry],
  exports: [
    IntegrationRegistry,
    SqlServerModule,
    SageX3Module,
    WorksuiteModule,
  ],
})
export class IntegrationsModule {}
