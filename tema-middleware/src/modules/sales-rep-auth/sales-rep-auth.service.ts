import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticationFailed } from '../../common/auth/auth.errors';
import {
  LocalTokenIssuer,
  localLoginNotAvailable,
} from '../../common/auth/local-token.issuer';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import {
  SalesRepAuthConfig,
  SqlServerConfig,
} from '../../config/configuration';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { SalesRepMapper } from './mappers/sales-rep.mapper';
import {
  SALES_REP_PERMISSIONS,
  SalesRepLoginResult,
  SalesRepSiteRow,
  SalesRepUserRow,
} from './models/sales-rep-identity.model';
import {
  PasswordVerifier,
  TECHNICIAN_PASSWORD_VERIFIER,
} from '../technician-auth/password/password-verifier';
import { Inject } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Sales Representative login (Phase 3.6). Same secure architecture as technician
 * login (parameterized SQL, transaction tracking, PasswordVerifier abstraction,
 * shared dev token issuer) but a SEPARATE domain/identity model.
 *
 * Security: never logs/returns XPWSD_0; generic authentication failure (no
 * username-exists / role / active oracle).
 */
@Injectable()
export class SalesRepAuthService {
  private readonly logger = new Logger(SalesRepAuthService.name);

  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: SalesRepMapper,
    private readonly tokenIssuer: LocalTokenIssuer,
    @Inject(TECHNICIAN_PASSWORD_VERIFIER)
    private readonly verifier: PasswordVerifier,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<SalesRepLoginResult> {
    if (!this.tokenIssuer.isAvailable()) throw localLoginNotAvailable();
    const sqlCfg = this.config.get<SqlServerConfig>('sqlServer')!;
    if (!sqlCfg.enabled) {
      throw new ServiceUnavailableException({
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'Sales Rep login data source is not configured',
      });
    }

    const cfg = this.config.get<SalesRepAuthConfig>('salesRepAuth')!;
    if (
      !SAFE_IDENTIFIER.test(cfg.schema) ||
      !SAFE_IDENTIFIER.test(cfg.usersTable) ||
      !SAFE_IDENTIFIER.test(cfg.sitesTable)
    ) {
      throw new ServiceUnavailableException({
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'Sales Rep login SQL source is misconfigured',
      });
    }

    const user = await this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'salesRepLogin',
        entityType: 'SalesRep',
      },
      () => this.fetchUser(cfg, username),
    );

    const stored = user ? this.mapper.readStoredPassword(user) : undefined;
    const passwordOk = await this.verifier.verify(password, stored);
    const eligible = user ? this.mapper.isEligible(user) : false;

    if (!user || !passwordOk || !eligible) {
      this.logger.warn(
        `sales-rep login result=failed correlationId=${getCorrelationId()}`,
      );
      throw authenticationFailed();
    }

    const sites = await this.fetchSites(cfg, username);
    const identity = this.mapper.toIdentity(user, sites);
    if (!identity) throw authenticationFailed();

    const { token, expiresIn } = this.tokenIssuer.issue({
      subject: identity.salesRepId,
      username: identity.username,
      roles: [identity.role],
      permissions: [...SALES_REP_PERMISSIONS],
    });

    this.logger.log(
      `sales-rep login result=success sites=${identity.sites.length} ` +
        `correlationId=${getCorrelationId()}`,
    );
    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      user: identity,
    };
  }

  private async fetchUser(
    cfg: SalesRepAuthConfig,
    username: string,
  ): Promise<SalesRepUserRow | undefined> {
    const text =
      `SELECT XAUS_0, XPWSD_0, XAUSNA_0, XEMAILID_0, XACT_0, XUSROLE_0 ` +
      `FROM [${cfg.schema}].[${cfg.usersTable}] WHERE XAUS_0 = @username`;
    const rows = await this.sql.query<SalesRepUserRow>(
      text,
      { username },
      'salesRepLogin',
    );
    return rows[0];
  }

  private async fetchSites(
    cfg: SalesRepAuthConfig,
    username: string,
  ): Promise<SalesRepSiteRow[]> {
    const text =
      `SELECT XFCY_0, XDEFFCY_0 FROM [${cfg.schema}].[${cfg.sitesTable}] ` +
      `WHERE XAUS_0 = @username ORDER BY XLINNO_0`;
    return this.sql.query<SalesRepSiteRow>(text, { username }, 'salesRepSites');
  }
}
