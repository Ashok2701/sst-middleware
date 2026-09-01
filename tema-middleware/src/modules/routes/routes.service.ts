import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import { RoutesConfig } from '../../config/configuration';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { RouteMapper } from './mappers/route.mapper';
import { Route, RouteHeader, SqlRow } from './models/route.model';
import { generateXdrn } from './xdrn-generator';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const HEADER_COLS =
  'XDRN_0, XROUTSTATUS_0, XROUTDATE_0, XTECHID_0, XTECHNAM_0, XSITE_0, XTRIP_0, XBYUSER_0';
const DETAIL_COLS =
  'XDRN_0, XDRNLIN_0, XDOCNUM_0, XBPCORD_0, XBPNAME_0, XSTATUS_0, XSERNUM_0, ' +
  'XETA_0, XETD_0, XSHIDAT_0, XDLVDAT_0, XBPAADDLIG_0, XCTY_0, XPOSCOD_0, XCRY_0';

/**
 * Read-only route access + XDRN generation (Phase 3.6). Returns a route header
 * with its detail lines. Route creation/persistence to Sage tables is NOT
 * implemented (see xdrn-generator for the pure generation logic).
 */
@Injectable()
export class RoutesService {
  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: RouteMapper,
  ) {}

  private cfg(): RoutesConfig {
    const c = this.config.get<RoutesConfig>('routes')!;
    for (const t of [c.schema, c.headerTable, c.detailTable]) {
      if (!SAFE_IDENTIFIER.test(t)) {
        throw new NotFoundException({
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Route source is misconfigured',
        });
      }
    }
    return c;
  }

  async list(limit?: number, site?: string): Promise<RouteHeader[]> {
    const c = this.cfg();
    const n = Math.min(Math.max(1, limit ?? c.maxResults), c.maxResults);
    const where = site ? 'WHERE XSITE_0 = @site' : '';
    const text =
      `SELECT TOP (${n}) ${HEADER_COLS} FROM [${c.schema}].[${c.headerTable}] ` +
      `${where} ORDER BY XROUTDATE_0 DESC`;
    const rows = await this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'listRoutes',
        entityType: 'Route',
      },
      () => this.sql.query<SqlRow>(text, site ? { site } : {}, 'listRoutes'),
    );
    return rows.map((r) => this.mapper.toHeader(r));
  }

  async getByXdrn(xdrn: string): Promise<Route> {
    const c = this.cfg();
    return this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'getRoute',
        entityType: 'Route',
        entityId: xdrn,
      },
      async () => {
        const header = (
          await this.sql.query<SqlRow>(
            `SELECT ${HEADER_COLS} FROM [${c.schema}].[${c.headerTable}] WHERE XDRN_0 = @xdrn`,
            { xdrn },
            'getRoute',
          )
        )[0];
        if (!header) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Route not found',
          });
        }
        const details = await this.sql.query<SqlRow>(
          `SELECT ${DETAIL_COLS} FROM [${c.schema}].[${c.detailTable}] WHERE XDRN_0 = @xdrn ORDER BY XDRNLIN_0`,
          { xdrn },
          'getRouteDetails',
        );
        return this.mapper.toRoute(header, details);
      },
    );
  }

  /**
   * Generates the next XDRN for a site (pure; does NOT persist). New routes are
   * intended to use status `newStatus` (default 1). The source status constant
   * (default 1524) is preserved in config but NOT written until confirmed.
   */
  generateXdrn(
    site: string,
    sequence: number,
  ): { xdrn: string; status: number } {
    const c = this.cfg();
    return {
      xdrn: generateXdrn(site, sequence, c.xdrnPrefix),
      status: c.newStatus,
    };
  }
}
