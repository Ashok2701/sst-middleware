import { validateEnv } from './env.validation';

describe('validateEnv - Phase 2 integration variables', () => {
  it('accepts a fully disabled integration configuration', () => {
    const cfg = validateEnv({
      SQL_SERVER_ENABLED: 'false',
      SAGE_X3_ENABLED: 'false',
    });
    expect(cfg.SQL_SERVER_ENABLED).toBe('false');
    expect(cfg.SAGE_X3_ENABLED).toBe('false');
  });

  it('accepts valid SQL Server settings', () => {
    const cfg = validateEnv({
      SQL_SERVER_ENABLED: 'true',
      SQL_SERVER_PORT: '1433',
      SQL_SERVER_ENCRYPT: 'true',
      SQL_SERVER_CONNECTION_TIMEOUT: '15000',
    });
    expect(cfg.SQL_SERVER_PORT).toBe(1433);
  });

  it('rejects a non-boolean SQL_SERVER_ENABLED', () => {
    expect(() => validateEnv({ SQL_SERVER_ENABLED: 'yes' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an unsupported SAGE_X3_AUTH_TYPE', () => {
    expect(() => validateEnv({ SAGE_X3_AUTH_TYPE: 'oauth-magic' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('accepts the supported Sage auth types', () => {
    for (const authType of ['none', 'basic', 'apikey']) {
      expect(() => validateEnv({ SAGE_X3_AUTH_TYPE: authType })).not.toThrow();
    }
  });
});
