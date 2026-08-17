import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';
import {
  computeBackoffMs,
  DEFAULT_RETRY_POLICY,
  executeWithRetry,
  isRetryable,
  NO_RETRY,
} from './retry.policy';

describe('retry.policy', () => {
  it('never retries under NO_RETRY', () => {
    const err = new IntegrationError(IntegrationErrorCode.TIMEOUT_ERROR);
    expect(isRetryable(err, NO_RETRY)).toBe(false);
  });

  it('retries transient codes under the default policy', () => {
    expect(
      isRetryable(
        new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR),
        DEFAULT_RETRY_POLICY,
      ),
    ).toBe(true);
  });

  it('does NOT retry non-transient codes (duplicate-risk safety)', () => {
    expect(
      isRetryable(
        new IntegrationError(IntegrationErrorCode.REMOTE_SYSTEM_ERROR),
        DEFAULT_RETRY_POLICY,
      ),
    ).toBe(false);
    expect(
      isRetryable(
        new IntegrationError(IntegrationErrorCode.DUPLICATE_OPERATION),
        DEFAULT_RETRY_POLICY,
      ),
    ).toBe(false);
  });

  it('applies exponential backoff capped at maxDelay (no jitter)', () => {
    const policy = { ...DEFAULT_RETRY_POLICY, jitter: false };
    expect(computeBackoffMs(1, policy)).toBe(200);
    expect(computeBackoffMs(2, policy)).toBe(400);
    expect(computeBackoffMs(3, policy)).toBe(800);
    expect(computeBackoffMs(10, policy)).toBe(policy.maxDelayMs);
  });

  it('retries then succeeds for a transient error', async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        if (calls < 3)
          throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR);
        return 'ok';
      },
      { ...DEFAULT_RETRY_POLICY, initialDelayMs: 0, jitter: false },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry a non-retryable error and rethrows it', async () => {
    let calls = 0;
    await expect(
      executeWithRetry(async () => {
        calls++;
        throw new IntegrationError(
          IntegrationErrorCode.REMOTE_VALIDATION_ERROR,
        );
      }, DEFAULT_RETRY_POLICY),
    ).rejects.toBeInstanceOf(IntegrationError);
    expect(calls).toBe(1);
  });
});
