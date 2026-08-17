import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';

/**
 * Retry policy abstraction.
 *
 * IMPORTANT: retries are OPERATION-AWARE. Business transactions that can create
 * duplicates (Purchase Receipt, Delivery, Payment, Job Completion) must use
 * NO_RETRY or combine retries with an idempotency key. This module only
 * provides the mechanism; business-specific rules are defined later, per
 * operation, once contracts are known.
 */
export interface RetryPolicy {
  /** Total attempts INCLUDING the first (1 = no retry). */
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  /** Error codes eligible for retry (transient by default). */
  retryableErrorCodes: IntegrationErrorCode[];
}

export const NO_RETRY: RetryPolicy = {
  maxAttempts: 1,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  jitter: false,
  retryableErrorCodes: [],
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitter: true,
  // Only transient, side-effect-free failures are retried by default.
  retryableErrorCodes: [
    IntegrationErrorCode.CONNECTION_ERROR,
    IntegrationErrorCode.TIMEOUT_ERROR,
    IntegrationErrorCode.RATE_LIMIT_ERROR,
  ],
};

export function isRetryable(error: unknown, policy: RetryPolicy): boolean {
  if (policy.maxAttempts <= 1) return false;
  if (error instanceof IntegrationError) {
    if (error.retryable === false) return false;
    return policy.retryableErrorCodes.includes(error.code);
  }
  return false;
}

export function computeBackoffMs(attempt: number, policy: RetryPolicy): number {
  // attempt is 1-based; delay applies before the (attempt+1)-th try.
  const raw =
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  const capped = Math.min(raw, policy.maxDelayMs);
  if (!policy.jitter) return capped;
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

/**
 * Executes `fn` applying the retry policy. `onRetry` is invoked before each
 * retry (useful for incrementing a transaction retry count / logging).
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < policy.maxAttempts && isRetryable(error, policy);
      if (!canRetry) break;
      const delay = computeBackoffMs(attempt, policy);
      onRetry?.(attempt, error, delay);
      await sleep(delay);
    }
  }
  throw (
    lastError ??
    new IntegrationError(IntegrationErrorCode.UNKNOWN_INTEGRATION_ERROR)
  );
}
