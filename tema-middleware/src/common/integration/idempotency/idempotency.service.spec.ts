import { IntegrationErrorCode } from '../errors/integration-error';
import { IdempotencyService } from './idempotency.service';
import { InMemoryIdempotencyStore } from './idempotency-store';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService(new InMemoryIdempotencyStore());
  });

  it('runs the operation once and returns its result', async () => {
    const fn = jest.fn().mockResolvedValue('result-1');
    const out = await service.execute('key-1', fn);
    expect(out).toBe('result-1');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('replays the stored result for a completed key (no re-execution)', async () => {
    const fn = jest.fn().mockResolvedValue('cached');
    await service.execute('key-2', fn);
    const second = await service.execute('key-2', fn);
    expect(second).toBe('cached');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects a concurrent in-progress duplicate with DUPLICATE_OPERATION', async () => {
    let release: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = service.execute('key-3', async () => {
      await gate;
      return 'first';
    });

    await expect(
      service.execute('key-3', async () => 'second'),
    ).rejects.toMatchObject({ code: IntegrationErrorCode.DUPLICATE_OPERATION });

    release!();
    expect(await first).toBe('first');
  });

  it('releases the key on failure so a retry can succeed', async () => {
    await expect(
      service.execute('key-4', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const out = await service.execute('key-4', async () => 'recovered');
    expect(out).toBe('recovered');
  });

  it('runs without idempotency when no key is provided', async () => {
    const fn = jest.fn().mockResolvedValue('x');
    await service.execute(undefined, fn);
    await service.execute(undefined, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
