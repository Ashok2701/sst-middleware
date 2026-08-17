import { SageX3Config } from '../../config/configuration';
import { createSageAuthProvider } from './sage-x3.auth';

function cfg(partial: Partial<SageX3Config>): SageX3Config {
  return {
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
}

describe('createSageAuthProvider', () => {
  it('adds no auth headers for authType=none', () => {
    const provider = createSageAuthProvider(cfg({ authType: 'none' }));
    expect(provider.type).toBe('none');
    expect(provider.applyAuthHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
    });
  });

  it('adds a Basic Authorization header for authType=basic', () => {
    const provider = createSageAuthProvider(
      cfg({ authType: 'basic', username: 'user', password: 'pass' }),
    );
    const headers = provider.applyAuthHeaders({});
    const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`;
    expect(headers.Authorization).toBe(expected);
  });

  it('adds the configured api-key header for authType=apikey', () => {
    const provider = createSageAuthProvider(
      cfg({ authType: 'apikey', apiKey: 'KEY123', apiKeyHeader: 'x-sage-key' }),
    );
    const headers = provider.applyAuthHeaders({});
    expect(headers['x-sage-key']).toBe('KEY123');
  });
});
