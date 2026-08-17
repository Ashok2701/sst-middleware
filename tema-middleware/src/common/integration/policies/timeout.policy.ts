import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';

export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Races a promise against a timeout. On timeout, rejects with a normalised
 * IntegrationError(TIMEOUT_ERROR). The underlying work is not cancelled (Node
 * promises are not cancellable) but the caller stops waiting.
 */
export function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  context: { operation?: string; targetSystem?: string } = {},
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new IntegrationError(IntegrationErrorCode.TIMEOUT_ERROR, {
          operation: context.operation,
          targetSystem: context.targetSystem,
          internalDetails: { timeoutMs },
        }),
      );
    }, timeoutMs);
  });

  return Promise.race([work, timeout]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}
