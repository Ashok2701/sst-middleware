import { ConfigService } from '@nestjs/config';
import { IntegrationStatus } from '../../common/integration/models/integration-health';
import { WorksuiteConfig } from '../../config/configuration';
import { WorksuiteAdapter } from './worksuite.adapter';
import { WorksuiteClient } from './worksuite.client';

function makeAdapter(
  partial: Partial<WorksuiteConfig>,
  client: Partial<WorksuiteClient>,
) {
  const cfg: WorksuiteConfig = {
    enabled: false,
    baseUrl: 'https://worksuite.example',
    timeoutMs: 30000,
    apiAuthType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/health',
    retryMaxAttempts: 3,
    retryInitialDelayMs: 0,
    webhook: {
      enabled: false,
      toleranceSeconds: 300,
      authMode: 'hmac-sha256',
      eventAliases: {},
    },
    password: { algorithm: 'PBKDF2-SHA256' },
    ...partial,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new WorksuiteAdapter(config, client as WorksuiteClient);
}

describe('WorksuiteAdapter', () => {
  it('reports DISABLED without calling WorkSuite when disabled', async () => {
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
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports DOWN (safe message) when the probe fails', async () => {
    const request = jest.fn().mockRejectedValue(new Error('secret-host down'));
    const adapter = makeAdapter({ enabled: true }, { request });
    const health = await adapter.checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Down);
    expect(JSON.stringify(health)).not.toContain('secret-host');
  });

  it('getContractor fails safely when the contractor path is not configured', async () => {
    const request = jest.fn();
    const adapter = makeAdapter(
      { enabled: true, contractorPathTemplate: undefined },
      { request },
    );
    await expect(adapter.getContractor('c1')).rejects.toMatchObject({
      code: 'CONNECTION_ERROR',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('getContractor pulls the raw record from the configured path', async () => {
    const request = jest
      .fn()
      .mockResolvedValue({ id: 'c1', role: 'Technician' });
    const adapter = makeAdapter(
      { enabled: true, contractorPathTemplate: '/partner/contractors/{id}' },
      { request },
    );
    const raw = await adapter.getContractor('c 1');
    expect(raw).toEqual({ id: 'c1', role: 'Technician' });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/partner/contractors/c%201',
        operation: 'getContractor',
      }),
    );
  });
});
