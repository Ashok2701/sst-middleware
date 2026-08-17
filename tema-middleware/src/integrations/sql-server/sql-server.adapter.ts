import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { SqlServerConfig } from '../../config/configuration';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../common/integration/errors/integration-error';
import { IntegrationAdapter } from '../../common/integration/interfaces/integration-adapter.interface';
import {
  IntegrationHealth,
  IntegrationStatus,
} from '../../common/integration/models/integration-health';

/**
 * SQL Server integration foundation.
 *
 * SAFETY: this adapter does NOT expose arbitrary SQL over any public API. It
 * offers `query` (parameterized) and `executeStoredProcedure` intended for
 * explicitly-defined internal operations only. No SQL text or parameter values
 * are ever logged, and credentials never appear in logs or health output.
 *
 * No business tables/procedures are invented here (none were provided).
 */
@Injectable()
export class SqlServerAdapter implements IntegrationAdapter, OnModuleDestroy {
  readonly name = 'sql-server';
  readonly targetSystem = 'SQL Server';

  private readonly logger = new Logger(SqlServerAdapter.name);
  private readonly cfg: SqlServerConfig;
  private pool?: sql.ConnectionPool;
  private connecting?: Promise<sql.ConnectionPool>;

  constructor(config: ConfigService) {
    this.cfg = config.get<SqlServerConfig>('sqlServer')!;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  /** Non-sensitive descriptor safe for logs/health (never includes password). */
  describeTarget(): { host?: string; database?: string; enabled: boolean } {
    return {
      host: this.cfg.host,
      database: this.cfg.database,
      enabled: this.cfg.enabled,
    };
  }

  private buildPoolConfig(): sql.config {
    return {
      server: this.cfg.host ?? '',
      port: this.cfg.port,
      database: this.cfg.database,
      user: this.cfg.user,
      password: this.cfg.password,
      connectionTimeout: this.cfg.connectionTimeoutMs,
      requestTimeout: this.cfg.requestTimeoutMs,
      pool: {
        min: this.cfg.poolMin,
        max: this.cfg.poolMax,
        idleTimeoutMillis: this.cfg.poolIdleTimeoutMs,
      },
      options: {
        encrypt: this.cfg.encrypt,
        trustServerCertificate: this.cfg.trustServerCertificate,
      },
    };
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (!this.cfg.enabled) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: this.targetSystem,
        message: 'SQL Server integration is disabled',
      });
    }
    if (this.pool?.connected) return this.pool;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        const pool = new sql.ConnectionPool(this.buildPoolConfig());
        pool.on('error', (err) =>
          this.logger.error(
            `SQL Server pool error [correlationId=${getCorrelationId()}]: ${err?.message}`,
          ),
        );
        await pool.connect();
        this.pool = pool;
        this.logger.log('SQL Server connection pool established');
        return pool;
      } catch (error) {
        throw this.mapError(error, 'connect');
      } finally {
        this.connecting = undefined;
      }
    })();

    return this.connecting;
  }

  /**
   * Runs a parameterized query. `params` are bound as named inputs (@name),
   * never string-concatenated. Intended for internally-defined operations.
   */
  async query<T = Record<string, unknown>>(
    text: string,
    params: Record<string, unknown> = {},
    operation = 'query',
  ): Promise<T[]> {
    const pool = await this.getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
    try {
      const result = await request.query<T>(text);
      return result.recordset as T[];
    } catch (error) {
      throw this.mapError(error, operation);
    }
  }

  /** Executes a stored procedure with named parameters. */
  async executeStoredProcedure<T = Record<string, unknown>>(
    procedureName: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const pool = await this.getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
    try {
      const result = await request.execute<T>(procedureName);
      return result.recordset as T[];
    } catch (error) {
      throw this.mapError(error, `sproc:${procedureName}`);
    }
  }

  async checkConnectivity(): Promise<IntegrationHealth> {
    if (!this.cfg.enabled) {
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Disabled,
        enabled: false,
        message: 'Integration disabled',
      };
    }
    const start = Date.now();
    try {
      const pool = await this.getPool();
      await pool.request().query('SELECT 1 AS ok');
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Up,
        enabled: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      // Log detail internally; return a safe status without any secret.
      this.logger.warn(
        `SQL Server connectivity check failed [correlationId=${getCorrelationId()}]: ` +
          `${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Down,
        enabled: true,
        latencyMs: Date.now() - start,
        message: 'Connectivity check failed',
      };
    }
  }

  private mapError(error: unknown, operation: string): IntegrationError {
    const err = error as { code?: string; message?: string };
    const code = err?.code;
    let mapped = IntegrationErrorCode.DATABASE_ERROR;
    if (code === 'ETIMEOUT' || code === 'ETIMEDOUT') {
      mapped = IntegrationErrorCode.TIMEOUT_ERROR;
    } else if (code === 'ELOGIN') {
      mapped = IntegrationErrorCode.AUTHENTICATION_ERROR;
    } else if (
      code === 'ESOCKET' ||
      code === 'ECONNREFUSED' ||
      code === 'ECONNCLOSED'
    ) {
      mapped = IntegrationErrorCode.CONNECTION_ERROR;
    }
    return new IntegrationError(mapped, {
      targetSystem: this.targetSystem,
      operation,
      cause: error,
      // Only the driver code is kept; never the SQL text or parameter values.
      internalDetails: { driverCode: code },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool?.connected) {
      try {
        await this.pool.close();
        this.logger.log('SQL Server connection pool closed');
      } catch {
        // ignore close errors on shutdown
      }
    }
  }
}
