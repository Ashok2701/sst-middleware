import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
  Silent = 'silent',
}

export enum SageAuthTypeEnum {
  None = 'none',
  Basic = 'basic',
  ApiKey = 'apikey',
}

export enum AuthProviderEnum {
  Dev = 'dev',
  Oidc = 'oidc',
}

export enum WorksuiteApiAuthTypeEnum {
  None = 'none',
  Bearer = 'bearer',
  ApiKey = 'apikey',
}

/**
 * Strongly-typed schema for the environment variables the app depends on.
 * Validation runs at startup so misconfiguration fails fast and loudly.
 *
 * All integration-specific variables are OPTIONAL so the application can start
 * with integrations disabled (SQL_SERVER_ENABLED / SAGE_X3_ENABLED = false).
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  TEMA_PORT: number = 8081;

  @IsString()
  @IsOptional()
  TEMA_BASE_URL?: string;

  @IsString()
  @IsOptional()
  FSM_SCHEDULER_BASE_URL?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  FSM_SCHEDULER_PORT?: number;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsBooleanString()
  @IsOptional()
  SWAGGER_ENABLED?: string;

  // ----- SQL Server integration (all optional) -----
  @IsBooleanString()
  @IsOptional()
  SQL_SERVER_ENABLED?: string;

  @IsString()
  @IsOptional()
  SQL_SERVER_HOST?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_PORT?: number;

  @IsString()
  @IsOptional()
  SQL_SERVER_DATABASE?: string;

  @IsString()
  @IsOptional()
  SQL_SERVER_USER?: string;

  @IsString()
  @IsOptional()
  SQL_SERVER_PASSWORD?: string;

  @IsBooleanString()
  @IsOptional()
  SQL_SERVER_ENCRYPT?: string;

  @IsBooleanString()
  @IsOptional()
  SQL_SERVER_TRUST_CERTIFICATE?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_CONNECTION_TIMEOUT?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_REQUEST_TIMEOUT?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_POOL_MIN?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_POOL_MAX?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SQL_SERVER_POOL_IDLE_TIMEOUT?: number;

  // ----- Sage X3 integration (all optional) -----
  @IsBooleanString()
  @IsOptional()
  SAGE_X3_ENABLED?: string;

  @IsString()
  @IsOptional()
  SAGE_X3_BASE_URL?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SAGE_X3_TIMEOUT?: number;

  @IsEnum(SageAuthTypeEnum)
  @IsOptional()
  SAGE_X3_AUTH_TYPE?: SageAuthTypeEnum;

  @IsString()
  @IsOptional()
  SAGE_X3_USERNAME?: string;

  @IsString()
  @IsOptional()
  SAGE_X3_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SAGE_X3_API_KEY?: string;

  @IsString()
  @IsOptional()
  SAGE_X3_API_KEY_HEADER?: string;

  @IsString()
  @IsOptional()
  SAGE_X3_HEALTH_PATH?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SAGE_X3_RETRY_MAX_ATTEMPTS?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SAGE_X3_RETRY_INITIAL_DELAY?: number;

  // ----- Rate limiting -----
  @IsBooleanString()
  @IsOptional()
  RATE_LIMIT_ENABLED?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  RATE_LIMIT_TTL?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  RATE_LIMIT_LIMIT?: number;

  // ----- Authentication (Phase 3.1) -----
  @IsBooleanString()
  @IsOptional()
  AUTH_ENABLED?: string;

  @IsEnum(AuthProviderEnum)
  @IsOptional()
  AUTH_PROVIDER?: AuthProviderEnum;

  @IsString()
  @IsOptional()
  AUTH_ISSUER?: string;

  @IsString()
  @IsOptional()
  AUTH_AUDIENCE?: string;

  @IsString()
  @IsOptional()
  AUTH_JWKS_URI?: string;

  @IsString()
  @IsOptional()
  AUTH_DEV_SECRET?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  AUTH_CLOCK_TOLERANCE?: number;

  // ----- Business-API data sources (Phase 3.3) -----
  @IsString()
  @IsOptional()
  SQL_TECHNICIANS_PROCEDURE?: string;

  // ----- WorkSuite integration (Phase 3.4 - all optional / pending) -----
  @IsBooleanString()
  @IsOptional()
  WORKSUITE_ENABLED?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_BASE_URL?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_API_TIMEOUT?: number;

  @IsEnum(WorksuiteApiAuthTypeEnum)
  @IsOptional()
  WORKSUITE_API_AUTH_TYPE?: WorksuiteApiAuthTypeEnum;

  @IsString()
  @IsOptional()
  WORKSUITE_API_TOKEN?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_API_KEY?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_API_KEY_HEADER?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_CONTRACTOR_PATH?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_HEALTH_PATH?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_RETRY_MAX_ATTEMPTS?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_RETRY_INITIAL_DELAY?: number;

  @IsBooleanString()
  @IsOptional()
  WORKSUITE_WEBHOOK_ENABLED?: string;

  @IsString()
  @IsOptional()
  WORKSUITE_WEBHOOK_SECRET?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_WEBHOOK_TOLERANCE_SECONDS?: number;

  @IsString()
  @IsOptional()
  WORKSUITE_PASSWORD_ALGORITHM?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_PBKDF2_ITERATIONS?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_PBKDF2_SALT_LENGTH?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WORKSUITE_PBKDF2_KEY_LENGTH?: number;

  @IsString()
  @IsOptional()
  WORKSUITE_PASSWORD_ENCODING?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration: ${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }

  return validated;
}
