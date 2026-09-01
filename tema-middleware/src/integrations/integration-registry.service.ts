import { Injectable } from '@nestjs/common';
import { IntegrationAdapter } from '../common/integration/interfaces/integration-adapter.interface';
import { IntegrationHealth } from '../common/integration/models/integration-health';
import { SageX3Adapter } from './sage-x3/sage-x3.adapter';
import { SqlServerAdapter } from './sql-server/sql-server.adapter';
import { WorksuiteAdapter } from './worksuite/worksuite.adapter';
import { LeadPerfectionAdapter } from './lead-perfection/lead-perfection.adapter';

/**
 * Registry of the concrete integration adapters. New adapters are added here
 * (and provided by their module) - the rest of the platform depends only on the
 * IntegrationAdapter contract, not on specific systems.
 */
@Injectable()
export class IntegrationRegistry {
  constructor(
    private readonly sqlServer: SqlServerAdapter,
    private readonly sageX3: SageX3Adapter,
    private readonly worksuite: WorksuiteAdapter,
    private readonly leadPerfection: LeadPerfectionAdapter,
  ) {}

  all(): IntegrationAdapter[] {
    return [this.sqlServer, this.sageX3, this.worksuite, this.leadPerfection];
  }

  /** Aggregated connectivity snapshot for all adapters (safe for /health). */
  async checkAll(): Promise<IntegrationHealth[]> {
    return Promise.all(
      this.all().map((adapter) => adapter.checkConnectivity()),
    );
  }
}
