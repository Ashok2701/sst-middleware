import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WorksuiteConfig } from '../../../config/configuration';
import {
  createWebhookAuthenticator,
  HmacWebhookAuthenticator,
} from './webhook-authenticator';
import { buildEventAliases } from '../worksuite-events';

const SECRET = 'auth-secret-auth-secret-auth-secret';

function cfg(secret?: string, authMode = 'hmac-sha256'): WorksuiteConfig {
  return {
    enabled: true,
    timeoutMs: 30000,
    apiAuthType: 'none',
    apiKeyHeader: 'x-api-key',
    healthPath: '/',
    retryMaxAttempts: 3,
    retryInitialDelayMs: 0,
    webhook: {
      enabled: true,
      secret,
      toleranceSeconds: 300,
      authMode,
      eventAliases: buildEventAliases({}),
    },
    password: { algorithm: 'PBKDF2-SHA256' },
  } as WorksuiteConfig;
}

function configService(c: WorksuiteConfig): ConfigService {
  return { get: () => c } as unknown as ConfigService;
}

function sign(raw: Buffer, ts: string): string {
  const signed = Buffer.concat([Buffer.from(`${ts}.`), raw]);
  return `sha256=${createHmac('sha256', SECRET).update(signed).digest('hex')}`;
}

describe('HmacWebhookAuthenticator (TEMPORARY, pluggable)', () => {
  const ts = String(Math.floor(Date.now() / 1000));

  it('factory returns the HMAC authenticator by default', () => {
    const auth = createWebhookAuthenticator(configService(cfg(SECRET)));
    expect(auth.mode).toBe('hmac-sha256');
    expect(auth).toBeInstanceOf(HmacWebhookAuthenticator);
  });

  it('is not configured without a secret', () => {
    const auth = new HmacWebhookAuthenticator(configService(cfg(undefined)));
    expect(auth.isConfigured()).toBe(false);
  });

  it('verifies a valid signature and rejects a tampered body', () => {
    const auth = new HmacWebhookAuthenticator(configService(cfg(SECRET)));
    const raw = Buffer.from('{"event":"contractor.created","partnerId":"1"}');
    expect(
      auth.verify({ rawBody: raw, timestamp: ts, signature: sign(raw, ts) }),
    ).toBe(true);
    const tampered = Buffer.from('{"event":"contractor.archived"}');
    expect(
      auth.verify({
        rawBody: tampered,
        timestamp: ts,
        signature: sign(raw, ts),
      }),
    ).toBe(false);
  });

  it('rejects a missing signature/timestamp', () => {
    const auth = new HmacWebhookAuthenticator(configService(cfg(SECRET)));
    const raw = Buffer.from('{}');
    expect(auth.verify({ rawBody: raw })).toBe(false);
  });

  it('falls back to HMAC for an unknown auth mode', () => {
    const auth = createWebhookAuthenticator(
      configService(cfg(SECRET, 'future-mechanism')),
    );
    expect(auth).toBeInstanceOf(HmacWebhookAuthenticator);
  });
});
