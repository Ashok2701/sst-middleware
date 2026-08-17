import { correlationStorage, getCorrelationId } from './correlation.context';

describe('correlation context (AsyncLocalStorage)', () => {
  it('returns undefined outside of a request scope', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('exposes the correlation id within run()', () => {
    correlationStorage.run({ correlationId: 'CTX-1' }, () => {
      expect(getCorrelationId()).toBe('CTX-1');
    });
  });

  it('isolates contexts across concurrent runs', async () => {
    const results: string[] = [];
    await Promise.all([
      new Promise<void>((resolve) =>
        correlationStorage.run({ correlationId: 'A' }, () => {
          setTimeout(() => {
            results.push(getCorrelationId()!);
            resolve();
          }, 5);
        }),
      ),
      new Promise<void>((resolve) =>
        correlationStorage.run({ correlationId: 'B' }, () => {
          setTimeout(() => {
            results.push(getCorrelationId()!);
            resolve();
          }, 1);
        }),
      ),
    ]);
    expect(results.sort()).toEqual(['A', 'B']);
  });
});
