/**
 * Standard internal integration error model.
 *
 * These codes are used INTERNALLY between adapters and the TEMA core. Raw
 * backend errors are never surfaced to external consumers - only the safe
 * `{ code, message, requestId }` shape is (via the global exception filter).
 */
export enum IntegrationErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  REMOTE_SYSTEM_ERROR = 'REMOTE_SYSTEM_ERROR',
  REMOTE_VALIDATION_ERROR = 'REMOTE_VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TRANSFORMATION_ERROR = 'TRANSFORMATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_OPERATION = 'DUPLICATE_OPERATION',
  UNKNOWN_INTEGRATION_ERROR = 'UNKNOWN_INTEGRATION_ERROR',
}

/** Safe, consumer-facing messages. Never include backend/internal detail. */
const SAFE_MESSAGES: Record<IntegrationErrorCode, string> = {
  [IntegrationErrorCode.VALIDATION_ERROR]: 'The request was invalid',
  [IntegrationErrorCode.AUTHENTICATION_ERROR]: 'Authentication failed',
  [IntegrationErrorCode.AUTHORIZATION_ERROR]: 'Not authorized',
  [IntegrationErrorCode.CONNECTION_ERROR]:
    'The downstream system could not be reached',
  [IntegrationErrorCode.TIMEOUT_ERROR]: 'The downstream system timed out',
  [IntegrationErrorCode.REMOTE_SYSTEM_ERROR]:
    'The downstream system could not complete the request',
  [IntegrationErrorCode.REMOTE_VALIDATION_ERROR]:
    'The downstream system rejected the request',
  [IntegrationErrorCode.RATE_LIMIT_ERROR]:
    'The downstream system is rate limiting requests',
  [IntegrationErrorCode.TRANSFORMATION_ERROR]:
    'The request or response could not be transformed',
  [IntegrationErrorCode.DATABASE_ERROR]: 'A database error occurred',
  [IntegrationErrorCode.DUPLICATE_OPERATION]:
    'This operation has already been processed',
  [IntegrationErrorCode.UNKNOWN_INTEGRATION_ERROR]:
    'An unexpected integration error occurred',
};

/** Error codes that are, by default, safe to retry (transient/no side effect). */
const DEFAULT_RETRYABLE = new Set<IntegrationErrorCode>([
  IntegrationErrorCode.CONNECTION_ERROR,
  IntegrationErrorCode.TIMEOUT_ERROR,
  IntegrationErrorCode.RATE_LIMIT_ERROR,
]);

export interface IntegrationErrorOptions {
  message?: string;
  targetSystem?: string;
  operation?: string;
  /** Explicit retry hint; defaults are derived from the code. */
  retryable?: boolean;
  /** Original error - kept for structured logs only, never exposed. */
  cause?: unknown;
  /** Internal-only technical details for logs, never exposed to consumers. */
  internalDetails?: Record<string, unknown>;
}

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly targetSystem?: string;
  readonly operation?: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
  readonly internalDetails?: Record<string, unknown>;

  constructor(
    code: IntegrationErrorCode,
    options: IntegrationErrorOptions = {},
  ) {
    super(options.message ?? SAFE_MESSAGES[code]);
    this.name = 'IntegrationError';
    this.code = code;
    this.targetSystem = options.targetSystem;
    this.operation = options.operation;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE.has(code);
    this.cause = options.cause;
    this.internalDetails = options.internalDetails;
  }

  /** Safe representation for API consumers (no internal details). */
  toPublic(requestId: string): {
    code: string;
    message: string;
    requestId: string;
  } {
    return {
      code: this.code,
      message: SAFE_MESSAGES[this.code],
      requestId,
    };
  }
}
