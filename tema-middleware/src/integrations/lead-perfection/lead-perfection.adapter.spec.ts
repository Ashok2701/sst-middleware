import { ConfigService } from '@nestjs/config';
import { IntegrationStatus } from '../../common/integration/models/integration-health';
import { LeadPerfectionConfig } from '../../config/configuration';
import { LeadPerfectionAdapter } from './lead-perfection.adapter';
import { LeadPerfectionClient } from './lead-perfection.client';

function make(partial: Partial<LeadPerfectionConfig>, get: jest.Mock) {
  const cfg: LeadPerfectionConfig = {
    enabled: false,
    baseUrl: 'https://lp.example',
    apiKey: 'k',
    apiKeyHeader: 'x-api-key',
    timeoutMs: 30000,
    healthPath: '/health',
    retryMaxAttempts: 3,
    retryInitialDelayMs: 0,
    ...partial,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new LeadPerfectionAdapter(config, {
    get,
  } as unknown as LeadPerfectionClient);
}

describe('LeadPerfectionAdapter', () => {
  it('reports DISABLED without calling LP when disabled', async () => {
    const get = jest.fn();
    const health = await make({ enabled: false }, get).checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Disabled);
    expect(get).not.toHaveBeenCalled();
  });

  it('reports UP when the connectivity probe succeeds', async () => {
    const get = jest.fn().mockResolvedValue({});
    const health = await make({ enabled: true }, get).checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Up);
    expect(get).toHaveBeenCalledWith('/health', 'checkConnectivity');
  });

  it('reports DOWN with a safe message when the probe fails', async () => {
    const get = jest.fn().mockRejectedValue(new Error('secret-lp-host down'));
    const health = await make({ enabled: true }, get).checkConnectivity();
    expect(health.status).toBe(IntegrationStatus.Down);
    expect(JSON.stringify(health)).not.toContain('secret-lp-host');
  });
});
