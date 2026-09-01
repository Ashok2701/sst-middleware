import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';
import { LocalTokenIssuer } from './local-token.issuer';

const SECRET = 'dev-secret-dev-secret-dev-secret-dev!!';

function issuer(auth: Partial<AuthConfig>, nodeEnv = 'test'): LocalTokenIssuer {
  const cfg: AuthConfig = {
    enabled: true,
    provider: 'dev',
    issuer: 'https://tema.test/',
    audience: 'tema-middleware',
    devSecret: SECRET,
    clockToleranceSeconds: 5,
    tokenTtlSeconds: 3600,
    ...auth,
  };
  const config = {
    get: (k: string) => (k === 'auth' ? cfg : nodeEnv),
  } as unknown as ConfigService;
  return new LocalTokenIssuer(config);
}

describe('LocalTokenIssuer', () => {
  it('mints a verifiable HS256 token with sub/roles/permissions/username', () => {
    const { token, expiresIn } = issuer({}).issue({
      subject: 'ID1',
      username: 'jdoe',
      roles: ['Technician'],
      permissions: ['technician.read'],
    });
    expect(expiresIn).toBe(3600);
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      issuer: 'https://tema.test/',
      audience: 'tema-middleware',
    }) as jwt.JwtPayload;
    expect(decoded.sub).toBe('ID1');
    expect(decoded.preferred_username).toBe('jdoe');
    expect(decoded.roles).toEqual(['Technician']);
    expect(decoded.permissions).toEqual(['technician.read']);
  });

  it('is available only for the dev provider in non-production', () => {
    expect(issuer({}).isAvailable()).toBe(true);
    expect(issuer({ provider: 'oidc' }).isAvailable()).toBe(false);
    expect(issuer({}, 'production').isAvailable()).toBe(false);
    expect(issuer({ devSecret: 'short' }).isAvailable()).toBe(false);
    expect(issuer({ issuer: undefined }).isAvailable()).toBe(false);
  });

  it('throws a safe INTEGRATION_NOT_CONFIGURED error when unavailable', () => {
    expect(() =>
      issuer({ provider: 'oidc' }).issue({
        subject: 'x',
        username: 'x',
        roles: [],
        permissions: [],
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'INTEGRATION_NOT_CONFIGURED',
        }),
      }),
    );
  });
});
