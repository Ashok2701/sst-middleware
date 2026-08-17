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

/**
 * Strongly-typed schema for the environment variables the app depends on.
 * Validation runs at startup so misconfiguration fails fast and loudly.
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
