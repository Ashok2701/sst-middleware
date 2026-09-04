import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import { CompaniesConfig } from '../../config/configuration';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { CompanyMapper } from './mappers/company.mapper';
import { Company, CompanyDetail, SqlRow } from './models/company.model';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// XPASSWRD_0 is intentionally NEVER selected.
const CREW_COLS = 'XCREWID_0, XCRENAM_0, XFCY_0, XACTIVE_0';
const TECH_COLS =
  'XTECH_0, XTECHNAM_0, XLEADTECH_0, XSKLTYP_0, XCRTFCN_0, XEMAIL_0';

/**
 * Read-only Companies (== Crews) access. Reads FSM.XCREW and joins FSM.XTECHNCN
 * on XCREWID_0 via parameterized queries inside the middleware (no DB views/DDL,
 * no CRUD). The crew password is never selected or exposed.
 */
@Injectable()
export class CompaniesService {
  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: CompanyMapper,
  ) {}

  private cfg(): CompaniesConfig {
    const c = this.config.get<CompaniesConfig>('companies')!;
    for (const t of [c.schema, c.crewTable, c.technicianTable]) {
      if (!SAFE_IDENTIFIER.test(t)) {
        throw new NotFoundException({
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Companies source is misconfigured',
        });
      }
    }
    return c;
  }

  /** Lists crews/companies, optionally filtered by site (XFCY_0). */
  async list(opts: { site?: string; limit?: number } = {}): Promise<Company[]> {
    const c = this.cfg();
    const n = Math.min(Math.max(1, opts.limit ?? c.maxResults), c.maxResults);
    const where = opts.site ? 'WHERE XFCY_0 = @site' : '';
    const text =
      `SELECT TOP (${n}) ${CREW_COLS} FROM [${c.schema}].[${c.crewTable}] ` +
      `${where} ORDER BY XCREWID_0`;
    const rows = await this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'listCompanies',
        entityType: 'Company',
      },
      () =>
        this.sql.query<SqlRow>(
          text,
          opts.site ? { site: opts.site } : {},
          'listCompanies',
        ),
    );
    return rows.map((r) => this.mapper.toCompany(r));
  }

  /** Crew/company summary only (used to enrich technician login). */
  async getSummary(crewId: string): Promise<Company | undefined> {
    const c = this.cfg();
    const rows = await this.sql.query<SqlRow>(
      `SELECT ${CREW_COLS} FROM [${c.schema}].[${c.crewTable}] WHERE XCREWID_0 = @id`,
      { id: crewId },
      'getCompany',
    );
    return rows[0] ? this.mapper.toCompany(rows[0]) : undefined;
  }

  /** Crew/company detail including its technicians (XTECHNCN.XCREWID_0 = id). */
  async getById(crewId: string): Promise<CompanyDetail> {
    const c = this.cfg();
    return this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'getCompany',
        entityType: 'Company',
        entityId: crewId,
      },
      async () => {
        const crew = (
          await this.sql.query<SqlRow>(
            `SELECT ${CREW_COLS} FROM [${c.schema}].[${c.crewTable}] WHERE XCREWID_0 = @id`,
            { id: crewId },
            'getCompany',
          )
        )[0];
        if (!crew) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Company not found',
          });
        }
        const technicians = await this.sql.query<SqlRow>(
          `SELECT ${TECH_COLS} FROM [${c.schema}].[${c.technicianTable}] ` +
            `WHERE XCREWID_0 = @id ORDER BY XTECH_0`,
          { id: crewId },
          'getCompanyTechnicians',
        );
        return this.mapper.toDetail(crew, technicians);
      },
    );
  }
}
