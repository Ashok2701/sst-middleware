import { AuthConfig } from '../../config/configuration';
import { createIdentityProvider } from './identity-provider.factory';

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })), {
  virtual: false,
});

function cfg(partial: Partial<AuthConfig> = {}): AuthConfig {
  return {
    enabled: true,
    provider: 'dev',
    issuer: 'https://tema.test/',
    audience: 'tema-middleware',
    devSecret: 'a'.repeat(48),
    clockToleranceSeconds: 5,
    tokenTtlSeconds: 3600,
    ...partial,
  };
}

describe('createIdentityProvider', () => {
  it('returns a disabled provider when auth is disabled', () => {
    const provider = createIdentityProvider(
      cfg({ enabled: false }),
      'production',
    );
    expect(provider.name).toBe('disabled');
  });

  it('builds the dev provider in non-production', () => {
    expect(createIdentityProvider(cfg(), 'development').name).toBe('dev');
  });

  it('NEVER builds the dev provider in production (fails safe)', () => {
    expect(() =>
      createIdentityProvider(cfg({ provider: 'dev' }), 'production'),
    ).toThrow(/cannot be enabled in production/);
  });

  it('builds the oidc provider when selected', () => {
    const provider = createIdentityProvider(
      cfg({
        provider: 'oidc',
        jwksUri: 'https://id.test/.well-known/jwks.json',
      }),
      'production',
    );
    expect(provider.name).toBe('oidc');
  });

  it('rejects a non-HTTPS JWKS URI for oidc', () => {
    expect(() =>
      createIdentityProvider(
        cfg({ provider: 'oidc', jwksUri: 'http://insecure/jwks' }),
        'production',
      ),
    ).toThrow(/HTTPS/);
  });
});
