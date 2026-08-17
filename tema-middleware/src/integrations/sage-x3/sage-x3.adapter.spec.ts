import { ConfigService } from '@nestjs/config';
import { IntegrationStatus } from '../../common/integration/models/integration-health';
import { SageX3Config } from '../../config/configuration';
import { SageX3Adapter } from './sage-x3.adapter';
import { SageX3Client } from './sage-x3.client';

function makeAdapter(
  partial: Partial<SageX3Config>,
  client: Partial<SageX3Client>,
) {
  const cfg: SageX3Config = {
    enabled: false,
    baseUrl: 'https://sage.example',
    timeoutMs: 30000,
    authType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/health',
    retryMaxAttempts: 1,
    retryInitialDelayMs: 200,
    ...partial,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new SageX3Adapter(config, client as SageX3Client);
}

describe('SageX3Adapter', () => {
  it('reports DISABLED without calling Sage when disabled', async () => {
    const request = jest.fn();
    const adapter = makeAdapter({ enabled: false }, { request });
    const health = await adapter.checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Disabled);
    expect(request).not.toHaveBeenCalled();
  });

  it('reports UP with latency when the connectivity probe succeeds', async () => {
    const request = jest.fn().mockResolvedValue({});
    const adapter = makeAdapter({ enabled: true }, { request });
    const health = await adapter.checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Up);
    expect(typeof health.latencyMs).toBe('number');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports DOWN (safe message) when the probe fails', async () => {
    const request = jest.fn().mockRejectedValue(new Error('secret-host down'));
    const adapter = makeAdapter({ enabled: true }, { request });
    const health = await adapter.checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Down);
    expect(health.message).toBe('Connectivity check failed');
    expect(JSON.stringify(health)).not.toContain('secret-host');
  });
});
