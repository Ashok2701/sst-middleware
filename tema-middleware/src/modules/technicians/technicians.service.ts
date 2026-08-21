import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { TechnicianMapper } from './mappers/technician.mapper';
import { Technician, TechnicianRow } from './models/technician.model';

/**
 * Business service for technician data. Goes through the integration core +
 * SQL Server adapter (parameterized stored procedure) - never a direct DB
 * connection. The actual SQL object name is configuration-supplied
 * (SQL_TECHNICIANS_PROCEDURE); no table/column/proc names are invented.
 */
@Injectable()
export class TechniciansService {
  private readonly logger = new Logger(TechniciansService.name);

  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: TechnicianMapper,
  ) {}

  async getTechnicians(): Promise<Technician[]> {
    const procedure = this.config.get<string>('technicians.procedure');
    if (!procedure) {
      // Fail safely and explicitly until the real SQL source is provided.
      throw new ServiceUnavailableException({
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'Technician data source is not configured',
      });
    }

    return this.tracker.track(
      {
        sourceSystem: 'TEMA Scheduling',
        targetSystem: 'SQL Server',
        operation: 'getTechnicians',
        entityType: 'Technician',
      },
      async () => {
        const rows =
          await this.sql.executeStoredProcedure<TechnicianRow>(procedure);
        const technicians = rows.map((r) => this.mapper.toCanonical(r));
        this.logger.log(
          `getTechnicians integration=sql-server count=${technicians.length} ` +
            `correlationId=${getCorrelationId()}`,
        );
        return technicians;
      },
    );
  }
}
