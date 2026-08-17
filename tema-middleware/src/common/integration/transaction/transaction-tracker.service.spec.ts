import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';
import { TransactionStatus } from './integration-transaction.model';
import { InMemoryTransactionStore } from './transaction-store';
import { TransactionTrackerService } from './transaction-tracker.service';

describe('TransactionTrackerService', () => {
  let store: InMemoryTransactionStore;
  let tracker: TransactionTrackerService;

  beforeEach(() => {
    store = new InMemoryTransactionStore();
    tracker = new TransactionTrackerService(store);
  });

  it('starts a transaction with STARTED status and an id', async () => {
    const tx = await tracker.start({
      targetSystem: 'SQL Server',
      operation: 'getThing',
    });
    expect(tx.transactionId).toBeDefined();
    expect(tx.status).toBe(TransactionStatus.Started);
    expect(tx.retryCount).toBe(0);
  });

  it('marks success and records durationMs via track()', async () => {
    const tx = await tracker.track(
      { targetSystem: 'Sage X3', operation: 'ping' },
      async () => 'ok',
    );
    expect(tx).toBe('ok');
  });

  it('records the error code and FAILED status when work throws', async () => {
    const spy = jest.spyOn(tracker, 'start');
    await expect(
      tracker.track(
        { targetSystem: 'Sage X3', operation: 'fail' },
        async () => {
          throw new IntegrationError(IntegrationErrorCode.REMOTE_SYSTEM_ERROR);
        },
      ),
    ).rejects.toBeInstanceOf(IntegrationError);

    const capturedId = (await spy.mock.results[0].value).transactionId;
    const stored = await store.findById(capturedId!);
    expect(stored?.status).toBe(TransactionStatus.Failed);
    expect(stored?.errorCode).toBe('REMOTE_SYSTEM_ERROR');
    expect(stored?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
