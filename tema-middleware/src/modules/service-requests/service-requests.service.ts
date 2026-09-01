import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import { ServiceRequestsConfig } from '../../config/configuration';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { ServiceRequestMapper } from './mappers/service-request.mapper';
import {
  ServiceRequestDetail,
  ServiceRequestSummary,
  SqlRow,
} from './models/service-request.model';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const HEADER_COLS =
  'SRENUM_0, SREDES_0, XSTATUS_0, XSRDATE_0, CREDAT_0, SREBPC_0, ' +
  'XBPAADDLIG_0, XCTY_0, XPOSCOD_0, XCRY_0, XDRN_0';

/**
 * Read-only Service Request access (Phase 3.6). Composes the header + nested
 * detail using parameterized queries inside the middleware (no DB views/DDL).
 * Controllers never touch SQL. No CRUD.
 */
@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: ServiceRequestMapper,
  ) {}

  private cfg(): ServiceRequestsConfig {
    const c = this.config.get<ServiceRequestsConfig>('serviceRequests')!;
    for (const t of [
      c.schema,
      c.table,
      c.baseTable,
      c.taskTable,
      c.jobCardTable,
    ]) {
      if (!SAFE_IDENTIFIER.test(t)) {
        throw new NotFoundException({
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Service Request source is misconfigured',
        });
      }
    }
    return c;
  }

  async list(limit?: number): Promise<ServiceRequestSummary[]> {
    const c = this.cfg();
    const n = Math.min(Math.max(1, limit ?? c.maxResults), c.maxResults);
    const text =
      `SELECT TOP (${n}) ${HEADER_COLS} FROM [${c.schema}].[${c.table}] ` +
      `ORDER BY SRENUM_0 DESC`;
    const rows = await this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'listServiceRequests',
        entityType: 'ServiceRequest',
      },
      () => this.sql.query<SqlRow>(text, {}, 'listServiceRequests'),
    );
    return rows.map((r) => this.mapper.toSummary(r));
  }

  async getById(id: string): Promise<ServiceRequestDetail> {
    const c = this.cfg();
    return this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'getServiceRequest',
        entityType: 'ServiceRequest',
        entityId: id,
      },
      async () => {
        const header = (
          await this.sql.query<SqlRow>(
            `SELECT ${HEADER_COLS} FROM [${c.schema}].[${c.table}] WHERE SRENUM_0 = @id`,
            { id },
            'getServiceRequest',
          )
        )[0];
        if (!header) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Service Request not found',
          });
        }
        const [bases, tasks, jobCards] = await Promise.all([
          this.sql.query<SqlRow>(
            `SELECT XLINUM_0, XCPNITM_0, XCPNTMDES_0, XCPNQTY_0, XUOM_0, XMACNUM_0, XMACSERNUM_0 ` +
              `FROM [${c.schema}].[${c.baseTable}] WHERE XSERNUM_0 = @id ORDER BY XLINUM_0`,
            { id },
            'getServiceRequestBases',
          ),
          this.sql.query<SqlRow>(
            `SELECT HDTNUM_0, HDTTYP_0, HDTITM_0, HDTQTY_0, HDTUOM_0, HDTAUS_0, HDTPLNDAT_0, HDTDONDAT_0 ` +
              `FROM [${c.schema}].[${c.taskTable}] WHERE SRENUM_0 = @id`,
            { id },
            'getServiceRequestTasks',
          ),
          this.sql.query<SqlRow>(
            `SELECT XJOBCARD_0, XTECH_0, XBASE_0, XDRN_0, XSTRDATE_0, XSTRTIME_0, XENDDATE_0, XENDTIME_0, XTYPE_0, XDURATION_0 ` +
              `FROM [${c.schema}].[${c.jobCardTable}] WHERE XSRENUM_0 = @id`,
            { id },
            'getServiceRequestJobCards',
          ),
        ]);
        return this.mapper.toDetail(header, bases, tasks, jobCards);
      },
    );
  }
}
