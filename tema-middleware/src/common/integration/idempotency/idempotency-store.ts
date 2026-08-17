import { Injectable } from '@nestjs/common';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface IdempotencyRecord<T = unknown> {
  key: string;
  status: IdempotencyStatus;
  result?: T;
  createdAt: number;
}

/**
 * Pluggable idempotency persistence.
 *
 * `begin` is an ATOMIC get-or-acquire primitive: if a record already exists it
 * is returned; otherwise the key is marked IN_PROGRESS and `undefined` is
 * returned (meaning "you acquired it"). This is what prevents duplicate
 * processing under concurrent retries.
 *
 * Default is in-memory with a TTL. A durable store is required for multi-instance
 * horizontal scaling; that dependency is documented rather than choosing a
 * datastore now (see README - idempotency strategy).
 */
export interface IdempotencyStore {
  begin<T>(key: string): Promise<IdempotencyRecord<T> | undefined>;
  complete<T>(key: string, result: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly items = new Map<string, IdempotencyRecord>();
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.items) {
      if (now - record.createdAt > this.ttlMs) this.items.delete(key);
    }
  }

  async begin<T>(key: string): Promise<IdempotencyRecord<T> | undefined> {
    this.evictExpired();
    const found = this.items.get(key);
    if (found) return found as IdempotencyRecord<T>;
    // Atomic acquire - runs before any await gap in the caller.
    this.items.set(key, { key, status: 'IN_PROGRESS', createdAt: Date.now() });
    return undefined;
  }

  async complete<T>(key: string, result: T): Promise<void> {
    this.items.set(key, {
      key,
      status: 'COMPLETED',
      result,
      createdAt: Date.now(),
    });
  }

  async delete(key: string): Promise<void> {
    this.items.delete(key);
  }
}
