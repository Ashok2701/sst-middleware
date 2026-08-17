import { Injectable } from '@nestjs/common';
import { IntegrationTransaction } from './integration-transaction.model';

/**
 * Pluggable persistence for integration transactions.
 *
 * The final datastore (PostgreSQL vs SQL Server for TEMA's own data) is NOT
 * decided yet, so the default is an in-memory implementation. Swap this token
 * for a durable store once the datastore is approved.
 */
export interface TransactionStore {
  save(transaction: IntegrationTransaction): Promise<void>;
  update(
    transactionId: string,
    patch: Partial<IntegrationTransaction>,
  ): Promise<void>;
  findById(transactionId: string): Promise<IntegrationTransaction | undefined>;
}

export const TRANSACTION_STORE = Symbol('TRANSACTION_STORE');

/** Bounded in-memory store - suitable for the foundation and tests only. */
@Injectable()
export class InMemoryTransactionStore implements TransactionStore {
  private readonly items = new Map<string, IntegrationTransaction>();
  private readonly maxItems = 5000;

  async save(transaction: IntegrationTransaction): Promise<void> {
    if (this.items.size >= this.maxItems) {
      const oldest = this.items.keys().next().value;
      if (oldest) this.items.delete(oldest);
    }
    this.items.set(transaction.transactionId, { ...transaction });
  }

  async update(
    transactionId: string,
    patch: Partial<IntegrationTransaction>,
  ): Promise<void> {
    const existing = this.items.get(transactionId);
    if (existing) this.items.set(transactionId, { ...existing, ...patch });
  }

  async findById(
    transactionId: string,
  ): Promise<IntegrationTransaction | undefined> {
    const found = this.items.get(transactionId);
    return found ? { ...found } : undefined;
  }
}
