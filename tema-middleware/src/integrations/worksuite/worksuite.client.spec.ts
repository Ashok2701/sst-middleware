import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { correlationStorage } from '../../common/correlation/correlation.context';
import { IntegrationErrorCode } from '../../common/integration/errors/integration-error';
import { DEFAULT_RETRY_POLICY } from '../../common/integration/policies/retry.policy';
import { WorksuiteConfig } from '../../config/configuration';
import { WorksuiteClient } from './worksuite.client';

jest.mock('axios');

const requestMock = jest.fn();
(axios as unknown as { create: jest.Mock }).create = jest
  .fn()
  .mockReturnValue({ request: requestMock });

function makeClient(
  partial: Partial<WorksuiteConfig> = {},
  applyAuth: (h: Record<string, string>) => Record<string, string> = (h) => h,
): WorksuiteClient {
  const cfg: WorksuiteConfig = {
    enabled: true,
    baseUrl: 'https://worksuite.example',
    timeoutMs: 30000,
    apiAuthType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/',
    retryMaxAttempts: 3,
    retryInitialDelayMs: 0,
    webhook: { enabled: false, toleranceSeconds: 300 },
    password: { algorithm: 'PBKDF2-SHA256' },
    ...partial,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new WorksuiteClient(config, applyAuth);
}

describe('WorksuiteClient', () => {
  beforeEach(() => requestMock.mockReset());

  it('returns response data and applies auth headers', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { ok: true } });
    const client = makeClient({}, (h) => ({ ...h, Authorization: 'Bearer t' }));
    const data = await client.request<{ ok: boolean }>({
      method: 'GET',
      path: '/x',
      operation: 'test',
    });
    expect(data).toEqual({ ok: true });
    expect(requestMock.mock.calls[0][0].headers.Authorization).toBe('Bearer t');
  });

  it('throws CONNECTION_ERROR when disabled and never calls axios', async () => {
    const client = makeClient({ enabled: false });
    await expect(
      client.request({ method: 'GET', path: '/x', operation: 'test' }),
    ).rejects.toMatchObject({ code: IntegrationErrorCode.CONNECTION_ERROR });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { status: 401 } }, IntegrationErrorCode.AUTHENTICATION_ERROR],
    [{ response: { status: 403 } }, IntegrationErrorCode.AUTHORIZATION_ERROR],
    [{ response: { status: 429 } }, IntegrationErrorCode.RATE_LIMIT_ERROR],
    [{ response: { status: 500 } }, IntegrationErrorCode.REMOTE_SYSTEM_ERROR],
    [{ code: 'ECONNABORTED' }, IntegrationErrorCode.TIMEOUT_ERROR],
    [{ code: 'ENOTFOUND' }, IntegrationErrorCode.CONNECTION_ERROR],
  ])(
    'maps downstream failure %j to the correct code',
    async (err, expected) => {
      requestMock.mockRejectedValue(err);
      const client = makeClient();
      await expect(
        client.request({ method: 'GET', path: '/x', operation: 'test' }),
      ).rejects.toMatchObject({ code: expected });
    },
  );

  it('does not leak downstream error detail on the public error shape', async () => {
    requestMock.mockRejectedValue({
      response: { status: 500 },
      message: 'internal-secret-host boom',
    });
    const client = makeClient();
    const err = (await client
      .request({ method: 'GET', path: '/x', operation: 'test' })
      .catch((e) => e)) as { toPublic: (id: string) => unknown };
    expect(JSON.stringify(err.toPublic('rid'))).not.toContain(
      'internal-secret-host',
    );
  });

  it('propagates the correlation id as a request header', async () => {
    requestMock.mockResolvedValue({ status: 200, data: {} });
    const client = makeClient();
    await correlationStorage.run({ correlationId: 'CID-9' }, async () => {
      await client.request({ method: 'GET', path: '/x', operation: 'test' });
    });
    expect(requestMock.mock.calls[0][0].headers['x-correlation-id']).toBe(
      'CID-9',
    );
  });

  it('retries a transient error when a retry policy is supplied', async () => {
    requestMock
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });
    const client = makeClient();
    const data = await client.request({
      method: 'GET',
      path: '/x',
      operation: 'safe-read',
      retry: { ...DEFAULT_RETRY_POLICY, initialDelayMs: 0, jitter: false },
    });
    expect(data).toEqual({ ok: true });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry by default', async () => {
    requestMock.mockRejectedValue({ code: 'ECONNREFUSED' });
    const client = makeClient();
    await expect(
      client.request({ method: 'GET', path: '/x', operation: 'read' }),
    ).rejects.toMatchObject({ code: IntegrationErrorCode.CONNECTION_ERROR });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
