import {
  IntegrationError,
  IntegrationErrorCode,
} from '../errors/integration-error';
import { withTimeout } from './timeout.policy';

describe('timeout.policy', () => {
  it('resolves when work completes before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 100);
    expect(result).toBe('done');
  });

  it('rejects with TIMEOUT_ERROR when work exceeds the timeout', async () => {
    const slow = new Promise((resolve) =>
      setTimeout(() => resolve('late'), 50),
    );
    await expect(withTimeout(slow, 10)).rejects.toMatchObject({
      code: IntegrationErrorCode.TIMEOUT_ERROR,
    });
  });

  it('produces an IntegrationError instance', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50));
    await expect(withTimeout(slow, 5)).rejects.toBeInstanceOf(IntegrationError);
  });
});
