import { ConfigService } from '@nestjs/config';
import { WorksuitePasswordVerifier } from './password-verifier';
import { WorksuiteConfig } from '../../../config/configuration';

function makeVerifier(
  password: Partial<WorksuiteConfig['password']>,
): WorksuitePasswordVerifier {
  const cfg: WorksuiteConfig = {
    enabled: true,
    timeoutMs: 30000,
    apiAuthType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/',
    retryMaxAttempts: 3,
    retryInitialDelayMs: 200,
    webhook: { enabled: false, toleranceSeconds: 300 },
    password: { algorithm: 'PBKDF2-SHA256', ...password },
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  return new WorksuitePasswordVerifier(config);
}

const CONFIGURED = {
  iterations: 1000, // low ONLY for tests; production value is pending WorkSuite
  saltLength: 16,
  keyLength: 32,
  encoding: 'base64url',
};

describe('WorksuitePasswordVerifier', () => {
  it('reports NOT configured while WorkSuite PBKDF2 params are pending', () => {
    const verifier = makeVerifier({}); // no iterations/salt/key/encoding
    expect(verifier.isConfigured()).toBe(false);
  });

  it('reports configured when all PBKDF2 params are supplied', () => {
    expect(makeVerifier(CONFIGURED).isConfigured()).toBe(true);
  });

  it('round-trips: verifies the correct password and rejects a wrong one', async () => {
    const verifier = makeVerifier(CONFIGURED);
    const credential = await verifier.hash('correct horse battery staple');
    expect(credential.algorithm).toBe('PBKDF2-SHA256');
    expect(
      await verifier.verify('correct horse battery staple', credential),
    ).toBe(true);
    expect(await verifier.verify('wrong password', credential)).toBe(false);
  });

  it('is driven by configuration parameters (iterations affect the hash)', async () => {
    const a = await makeVerifier({ ...CONFIGURED, iterations: 1000 }).hash(
      'pw',
    );
    const b = await makeVerifier({ ...CONFIGURED, iterations: 2000 }).hash(
      'pw',
    );
    expect(a.iterations).toBe(1000);
    expect(b.iterations).toBe(2000);
  });

  it('rejects an unsupported algorithm', async () => {
    const verifier = makeVerifier(CONFIGURED);
    const ok = await verifier.verify('pw', {
      algorithm: 'bcrypt',
      hash: 'x',
      salt: 'y',
    });
    expect(ok).toBe(false);
  });

  it('rejects a credential missing salt or hash', async () => {
    const verifier = makeVerifier(CONFIGURED);
    expect(
      await verifier.verify('pw', {
        algorithm: 'PBKDF2-SHA256',
        hash: '',
        salt: '',
      }),
    ).toBe(false);
  });

  it('throws when hashing but params are pending (not yet WorkSuite-compatible)', async () => {
    const verifier = makeVerifier({}); // pending
    await expect(verifier.hash('pw')).rejects.toThrow(/not configured/i);
  });
});
