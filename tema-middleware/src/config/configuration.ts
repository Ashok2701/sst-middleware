/**
 * Central, typed configuration loaded from environment variables.
 * No secrets or real URLs live here - only how env vars map to config keys.
 */

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type SageAuthType = 'none' | 'basic' | 'apikey';

export interface SqlServerConfig {
  enabled: boolean;
  host?: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  poolMin: number;
  poolMax: number;
  poolIdleTimeoutMs: number;
}

export interface SageX3Config {
  enabled: boolean;
  baseUrl?: string;
  timeoutMs: number;
  authType: SageAuthType;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader: string;
  healthPath: string;
  retryMaxAttempts: number;
  retryInitialDelayMs: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  ttlMs: number;
  limit: number;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  temaBaseUrl?: string;
  fsmScheduler: { baseUrl?: string; port?: number };
  databaseUrl?: string;
  logLevel: string;
  swaggerEnabled: boolean;
  sqlServer: SqlServerConfig;
  sageX3: SageX3Config;
  rateLimit: RateLimitConfig;
}

function resolveSwaggerEnabled(nodeEnv: string): boolean {
  if (process.env.SWAGGER_ENABLED !== undefined) {
    return process.env.SWAGGER_ENABLED.toLowerCase() === 'true';
  }
  return nodeEnv !== 'production';
}

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    port: parseIntEnv(process.env.TEMA_PORT, 8081),
    temaBaseUrl: process.env.TEMA_BASE_URL,
    fsmScheduler: {
      baseUrl: process.env.FSM_SCHEDULER_BASE_URL,
      port: process.env.FSM_SCHEDULER_PORT
        ? parseInt(process.env.FSM_SCHEDULER_PORT, 10)
        : undefined,
    },
    databaseUrl: process.env.DATABASE_URL,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    swaggerEnabled: resolveSwaggerEnabled(nodeEnv),

    sqlServer: {
      enabled: parseBool(process.env.SQL_SERVER_ENABLED, false),
      host: process.env.SQL_SERVER_HOST,
      port: parseIntEnv(process.env.SQL_SERVER_PORT, 1433),
      database: process.env.SQL_SERVER_DATABASE,
      user: process.env.SQL_SERVER_USER,
      password: process.env.SQL_SERVER_PASSWORD,
      encrypt: parseBool(process.env.SQL_SERVER_ENCRYPT, true),
      trustServerCertificate: parseBool(
        process.env.SQL_SERVER_TRUST_CERTIFICATE,
        false,
      ),
      connectionTimeoutMs: parseIntEnv(
        process.env.SQL_SERVER_CONNECTION_TIMEOUT,
        15000,
      ),
      requestTimeoutMs: parseIntEnv(
        process.env.SQL_SERVER_REQUEST_TIMEOUT,
        15000,
      ),
      poolMin: parseIntEnv(process.env.SQL_SERVER_POOL_MIN, 0),
      poolMax: parseIntEnv(process.env.SQL_SERVER_POOL_MAX, 10),
      poolIdleTimeoutMs: parseIntEnv(
        process.env.SQL_SERVER_POOL_IDLE_TIMEOUT,
        30000,
      ),
    },

    sageX3: {
      enabled: parseBool(process.env.SAGE_X3_ENABLED, false),
      baseUrl: process.env.SAGE_X3_BASE_URL,
      timeoutMs: parseIntEnv(process.env.SAGE_X3_TIMEOUT, 30000),
      authType: (process.env.SAGE_X3_AUTH_TYPE as SageAuthType) ?? 'none',
      username: process.env.SAGE_X3_USERNAME,
      password: process.env.SAGE_X3_PASSWORD,
      apiKey: process.env.SAGE_X3_API_KEY,
      apiKeyHeader: process.env.SAGE_X3_API_KEY_HEADER ?? 'x-api-key',
      healthPath: process.env.SAGE_X3_HEALTH_PATH ?? '/',
      retryMaxAttempts: parseIntEnv(process.env.SAGE_X3_RETRY_MAX_ATTEMPTS, 1),
      retryInitialDelayMs: parseIntEnv(
        process.env.SAGE_X3_RETRY_INITIAL_DELAY,
        200,
      ),
    },

    rateLimit: {
      enabled: parseBool(process.env.RATE_LIMIT_ENABLED, true),
      ttlMs: parseIntEnv(process.env.RATE_LIMIT_TTL, 60000),
      limit: parseIntEnv(process.env.RATE_LIMIT_LIMIT, 300),
    },
  };
};
