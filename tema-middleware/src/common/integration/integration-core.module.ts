import { Global, Module } from '@nestjs/common';
import {
  IDEMPOTENCY_STORE,
  InMemoryIdempotencyStore,
} from './idempotency/idempotency-store';
import { IdempotencyService } from './idempotency/idempotency.service';
import {
  InMemoryTransactionStore,
  TRANSACTION_STORE,
} from './transaction/transaction-store';
import { TransactionTrackerService } from './transaction/transaction-tracker.service';

/**
 * Provides the reusable integration reliability services (transaction tracking
 * and idempotency) with in-memory default stores. Global so any adapter or
 * future business module can inject them. Swap the store tokens for durable
 * implementations when TEMA's datastore is approved.
 */
@Global()
@Module({
  providers: [
    { provide: TRANSACTION_STORE, useClass: InMemoryTransactionStore },
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
    TransactionTrackerService,
    IdempotencyService,
  ],
  exports: [TransactionTrackerService, IdempotencyService],
})
export class IntegrationCoreModule {}
