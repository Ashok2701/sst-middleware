import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getCorrelationId } from '../../correlation/correlation.context';
import { IntegrationError } from '../errors/integration-error';
import {
  IntegrationTransaction,
  TransactionStatus,
} from './integration-transaction.model';
import { TRANSACTION_STORE, TransactionStore } from './transaction-store';

export interface StartTransactionInput {
  targetSystem: string;
  operation: string;
  sourceSystem?: string;
  operationId?: string;
  entityType?: string;
  entityId?: string;
  transactionId?: string;
}

/**
 * Tracks the lifecycle of an integration transaction (start -> success/failure)
 * carrying correlationId from the request context. This is audit/support
 * foundation only - no business rules here.
 */
@Injectable()
export class TransactionTrackerService {
  constructor(
    @Inject(TRANSACTION_STORE) private readonly store: TransactionStore,
  ) {}

  async start(input: StartTransactionInput): Promise<IntegrationTransaction> {
    const transaction: IntegrationTransaction = {
      transactionId: input.transactionId ?? randomUUID(),
      correlationId: getCorrelationId(),
      operationId: input.operationId,
      sourceSystem: input.sourceSystem,
      targetSystem: input.targetSystem,
      operation: input.operation,
      entityType: input.entityType,
      entityId: input.entityId,
      status: TransactionStatus.Started,
      startedAt: new Date().toISOString(),
      retryCount: 0,
    };
    await this.store.save(transaction);
    return transaction;
  }

  async recordRetry(transactionId: string, retryCount: number): Promise<void> {
    await this.store.update(transactionId, {
      status: TransactionStatus.Retrying,
      retryCount,
    });
  }

  async complete(
    transaction: IntegrationTransaction,
    outcome: { success: boolean; errorCode?: string },
  ): Promise<void> {
    const completedAt = new Date();
    await this.store.update(transaction.transactionId, {
      status: outcome.success
        ? TransactionStatus.Success
        : TransactionStatus.Failed,
      completedAt: completedAt.toISOString(),
      durationMs:
        completedAt.getTime() - new Date(transaction.startedAt).getTime(),
      errorCode: outcome.errorCode,
    });
  }

  findById(transactionId: string): Promise<IntegrationTransaction | undefined> {
    return this.store.findById(transactionId);
  }

  /** Convenience wrapper: track a unit of work end-to-end. */
  async track<T>(
    input: StartTransactionInput,
    fn: () => Promise<T>,
  ): Promise<T> {
    const tx = await this.start(input);
    try {
      const result = await fn();
      await this.complete(tx, { success: true });
      return result;
    } catch (error) {
      const errorCode =
        error instanceof IntegrationError
          ? error.code
          : 'UNKNOWN_INTEGRATION_ERROR';
      await this.complete(tx, { success: false, errorCode });
      throw error;
    }
  }
}
