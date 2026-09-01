import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticationFailed } from '../../common/auth/auth.errors';
import { LocalTokenIssuer } from '../../common/auth/local-token.issuer';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import {
  SqlServerConfig,
  TechnicianAuthConfig,
} from '../../config/configuration';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { TechnicianIdentityMapper } from './mappers/technician-identity.mapper';
import {
  TechnicianLoginResult,
  TechnicianLoginRow,
  TECHNICIAN_PERMISSIONS,
} from './models/technician-identity.model';
import {
  PasswordVerifier,
  TECHNICIAN_PASSWORD_VERIFIER,
} from './password/password-verifier';
import {
  loginNotAvailable,
  loginSourceNotConfigured,
} from './technician-auth.errors';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Technician / Lead Technician login service (Phase 3.5).
 *
 * Flow: Controller -> Service -> Integration Core (transaction tracking) ->
 * SQL Server Adapter (parameterized) -> Mapper -> canonical identity -> token.
 * The controller never touches SQL directly. All SQL is parameterized.
 *
 * Security: never logs/returns XPASSWRD_0 or any password; authentication
 * failures are generic (no username-exists / not-found / wrong-password oracle).
 */
@Injectable()
export class TechnicianAuthService {
  private readonly logger = new Logger(TechnicianAuthService.name);

  constructor(
    private readonly sql: SqlServerAdapter,
    private readonly config: ConfigService,
    private readonly tracker: TransactionTrackerService,
    private readonly mapper: TechnicianIdentityMapper,
    private readonly tokenIssuer: LocalTokenIssuer,
    @Inject(TECHNICIAN_PASSWORD_VERIFIER)
    private readonly verifier: PasswordVerifier,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<TechnicianLoginResult> {
    // Config-level gates (not per-user): fail fast with a safe error.
    if (!this.tokenIssuer.isAvailable()) {
      throw loginNotAvailable();
    }
    const sqlCfg = this.config.get<SqlServerConfig>('sqlServer')!;
    if (!sqlCfg.enabled) {
      throw loginSourceNotConfigured();
    }

    const rows = await this.tracker.track(
      {
        sourceSystem: 'TEMA',
        targetSystem: 'SQL Server',
        operation: 'technicianLogin',
        entityType: 'Technician',
      },
      () => this.fetchByUsername(username),
    );

    const row = rows[0];
    const stored = row ? this.mapper.readStoredPassword(row) : undefined;
    // Always run verification (even without a row) to reduce a user-exists oracle.
    const passwordOk = await this.verifier.verify(password, stored);

    const identity = row ? this.mapper.toIdentity(row) : undefined;

    if (!row || !passwordOk || !identity) {
      this.logger.warn(
        `technician login result=failed correlationId=${getCorrelationId()}`,
      );
      throw authenticationFailed();
    }

    const { token, expiresIn } = this.tokenIssuer.issue({
      subject: identity.technicianId,
      username: identity.username,
      roles: [identity.role],
      permissions: [...TECHNICIAN_PERMISSIONS],
    });

    this.logger.log(
      `technician login result=success role=${identity.role} ` +
        `correlationId=${getCorrelationId()}`,
    );

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      user: identity,
    };
  }

  /**
   * Retrieves the technician row by username. Uses a stored procedure when
   * configured, otherwise a parameterized query against the configured
   * schema/table. Schema/table come from trusted config and are still validated
   * as safe identifiers before interpolation; the username is always a bound
   * parameter (never concatenated).
   */
  private async fetchByUsername(
    username: string,
  ): Promise<TechnicianLoginRow[]> {
    const ta = this.config.get<TechnicianAuthConfig>('technicianAuth')!;

    if (ta.loginProcedure) {
      return this.sql.executeStoredProcedure<TechnicianLoginRow>(
        ta.loginProcedure,
        { username },
      );
    }

    if (
      !SAFE_IDENTIFIER.test(ta.schema) ||
      !SAFE_IDENTIFIER.test(ta.table) ||
      !SAFE_IDENTIFIER.test(ta.usernameColumn)
    ) {
      throw loginSourceNotConfigured(
        'Technician login SQL source is misconfigured',
      );
    }
    // The configured username column is aliased to a stable output name so the
    // mapper stays column-name agnostic. The username is always bound (@username).
    const text =
      `SELECT XTECH_0, [${ta.usernameColumn}] AS XTECHNCN_0, XPASSWRD_0, XLEADTECH_0 ` +
      `FROM [${ta.schema}].[${ta.table}] WHERE [${ta.usernameColumn}] = @username`;
    return this.sql.query<TechnicianLoginRow>(
      text,
      { username },
      'technicianLogin',
    );
  }
}
