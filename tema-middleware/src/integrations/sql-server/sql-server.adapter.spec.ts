import { ConfigService } from '@nestjs/config';
import { IntegrationStatus } from '../../common/integration/models/integration-health';
import { SqlServerConfig } from '../../config/configuration';
import { SqlServerAdapter } from './sql-server.adapter';

function configWith(cfg: Partial<SqlServerConfig>): ConfigService {
  const full: SqlServerConfig = {
    enabled: false,
    host: undefined,
    port: 1433,
    database: undefined,
    user: undefined,
    password: undefined,
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeoutMs: 15000,
    requestTimeoutMs: 15000,
    poolMin: 0,
    poolMax: 10,
    poolIdleTimeoutMs: 30000,
    ...cfg,
  };
  return { get: () => full } as unknown as ConfigService;
}

describe('SqlServerAdapter', () => {
  it('reports DISABLED without attempting to connect when disabled', async () => {
    const adapter = new SqlServerAdapter(configWith({ enabled: false }));
    const health = await adapter.checkConnectivity();
    expect(health).toMatchObject({
      name: 'sql-server',
      targetSystem: 'SQL Server',
      status: IntegrationStatus.Disabled,
      enabled: false,
    });
    expect(health.latencyMs).toBeUndefined();
  });

  it('exposes a target descriptor that never contains the password', () => {
    const adapter = new SqlServerAdapter(
      configWith({
        enabled: true,
        host: 'db.internal',
        database: 'TEMA',
        user: 'svc',
        password: 'super-secret-pass',
      }),
    );
    const described = adapter.describeTarget();
    expect(described).toEqual({
      host: 'db.internal',
      database: 'TEMA',
      enabled: true,
    });
    expect(JSON.stringify(described)).not.toContain('super-secret-pass');
    expect(JSON.stringify(described)).not.toContain('svc');
  });

  it('rejects query attempts when the integration is disabled', async () => {
    const adapter = new SqlServerAdapter(configWith({ enabled: false }));
    await expect(adapter.query('SELECT 1', {}, 'test')).rejects.toMatchObject({
      code: 'CONNECTION_ERROR',
    });
  });
});
