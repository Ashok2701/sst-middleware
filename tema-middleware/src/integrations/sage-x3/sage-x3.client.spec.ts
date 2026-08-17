import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { correlationStorage } from '../../common/correlation/correlation.context';
import { IntegrationErrorCode } from '../../common/integration/errors/integration-error';
import { DEFAULT_RETRY_POLICY } from '../../common/integration/policies/retry.policy';
import { SageX3Config } from '../../config/configuration';
import { SageX3Client } from './sage-x3.client';

jest.mock('axios');

const requestMock = jest.fn();
(axios as unknown as { create: jest.Mock }).create = jest
  .fn()
  .mockReturnValue({ request: requestMock });

function makeClient(
  partial: Partial<SageX3Config> = {},
  applyAuth: (h: Record<string, string>) => Record<string, string> = (h) => h,
): SageX3Client {
  const cfg: SageX3Config = {
    enabled: true,
    baseUrl: 'https://sage.example',
    timeoutMs: 30000,
    authType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/',
    retryMaxAttempts: 1,
    retryInitialDelayMs: 200,
    ...partial,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new SageX3Client(config, applyAuth);
}

describe('SageX3Client', () => {
  beforeEach(() => requestMock.mockReset());

  it('returns response data on success and applies auth headers', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { ok: true } });
    const client = makeClient({}, (h) => ({
      ...h,
      Authorization: 'Basic xyz',
    }));

    const data = await client.request<{ ok: boolean }>({
      method: 'GET',
      path: '/x',
      operation: 'test',
    });

    expect(data).toEqual({ ok: true });
    const passedHeaders = requestMock.mock.calls[0][0].headers;
    expect(passedHeaders.Authorization).toBe('Basic xyz');
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
    [
      { response: { status: 422 } },
      IntegrationErrorCode.REMOTE_VALIDATION_ERROR,
    ],
    [{ response: { status: 500 } }, IntegrationErrorCode.REMOTE_SYSTEM_ERROR],
    [{ code: 'ECONNABORTED' }, IntegrationErrorCode.TIMEOUT_ERROR],
    [{ code: 'ECONNREFUSED' }, IntegrationErrorCode.CONNECTION_ERROR],
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

  it('raises TRANSFORMATION_ERROR when response validation fails', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { bad: true } });
    const client = makeClient();
    await expect(
      client.request({
        method: 'GET',
        path: '/x',
        operation: 'test',
        validate: (d: any): d is { ok: boolean } => d?.ok === true,
      }),
    ).rejects.toMatchObject({
      code: IntegrationErrorCode.TRANSFORMATION_ERROR,
    });
  });

  it('propagates the correlation id as a request header', async () => {
    requestMock.mockResolvedValue({ status: 200, data: {} });
    const client = makeClient();
    await correlationStorage.run({ correlationId: 'CID-9' }, async () => {
      await client.request({ method: 'GET', path: '/x', operation: 'test' });
    });
    const headers = requestMock.mock.calls[0][0].headers;
    expect(headers['x-correlation-id']).toBe('CID-9');
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

  it('does NOT retry by default (duplicate-risk safety)', async () => {
    requestMock.mockRejectedValue({ code: 'ECONNREFUSED' });
    const client = makeClient();
    await expect(
      client.request({ method: 'POST', path: '/x', operation: 'write' }),
    ).rejects.toMatchObject({ code: IntegrationErrorCode.CONNECTION_ERROR });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
