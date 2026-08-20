import jwt from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';
import { DevJwtProvider } from './dev-jwt.provider';
import { TokenVerificationError } from './auth.types';

const SECRET = 'a'.repeat(48);
const ISSUER = 'https://tema.test/';
const AUDIENCE = 'tema-middleware';

function cfg(partial: Partial<AuthConfig> = {}): AuthConfig {
  return {
    enabled: true,
    provider: 'dev',
    issuer: ISSUER,
    audience: AUDIENCE,
    devSecret: SECRET,
    clockToleranceSeconds: 5,
    ...partial,
  };
}

function sign(payload: object, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: '10m',
    ...options,
  });
}

describe('DevJwtProvider', () => {
  it('refuses to construct in production', () => {
    expect(() => new DevJwtProvider(cfg(), 'production')).toThrow(/production/);
  });

  it('requires a sufficiently long secret', () => {
    expect(
      () => new DevJwtProvider(cfg({ devSecret: 'short' }), 'test'),
    ).toThrow(/AUTH_DEV_SECRET/);
  });

  it('verifies a valid token and maps canonical claims', async () => {
    const provider = new DevJwtProvider(cfg(), 'test');
    const user = await provider.verify(
      sign({
        sub: 'user-1',
        email: 'a@b.com',
        roles: ['tech'],
        scope: 'read write',
      }),
    );
    expect(user).toMatchObject({
      userId: 'user-1',
      email: 'a@b.com',
      roles: ['tech'],
      permissions: ['read', 'write'],
      identityProvider: 'dev',
    });
  });

  it('flags expired tokens distinctly', async () => {
    const provider = new DevJwtProvider(cfg(), 'test');
    const token = sign({ sub: 'u' }, { expiresIn: -10 });
    await expect(provider.verify(token)).rejects.toMatchObject({
      kind: 'expired',
    });
  });

  it('rejects a wrong signature as invalid', async () => {
    const provider = new DevJwtProvider(cfg(), 'test');
    const bad = jwt.sign({ sub: 'u' }, 'wrong-secret-wrong-secret-wrong!!', {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '5m',
    });
    await expect(provider.verify(bad)).rejects.toBeInstanceOf(
      TokenVerificationError,
    );
    await expect(provider.verify(bad)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('rejects wrong issuer / audience as invalid', async () => {
    const provider = new DevJwtProvider(cfg(), 'test');
    const wrongIss = sign({ sub: 'u' }, { issuer: 'https://evil/' });
    await expect(provider.verify(wrongIss)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
