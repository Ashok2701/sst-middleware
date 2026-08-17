import { Inject, Injectable } from '@nestjs/common';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './idempotency-store';

/**
 * Prevents duplicate processing when a client retries the same business
 * operation with the same idempotency key.
 *
 *   - COMPLETED  -> return the previously stored result (safe replay).
 *   - IN_PROGRESS -> reject with DUPLICATE_OPERATION (concurrent retry).
 *   - absent      -> mark in-progress, run, store result.
 *
 * If no key is supplied, the operation simply runs (no idempotency applied).
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
  ) {}

  async execute<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn();

    const existing = await this.store.begin<T>(key);
    if (existing?.status === 'COMPLETED') {
      return existing.result as T;
    }
    if (existing?.status === 'IN_PROGRESS') {
      throw new IntegrationError(IntegrationErrorCode.DUPLICATE_OPERATION, {
        internalDetails: { key },
      });
    }

    // existing === undefined -> we acquired the key.
    try {
      const result = await fn();
      await this.store.complete(key, result);
      return result;
    } catch (error) {
      // Failed operations release the key so the client can safely retry.
      await this.store.delete(key);
      throw error;
    }
  }
}
