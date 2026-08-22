import { createHmac } from 'node:crypto';
import { verifyWorksuiteSignature } from './worksuite-signature';

const SECRET = 'ws-webhook-secret-ws-webhook-secret';

function sign(rawBody: Buffer, timestamp: string, secret = SECRET): string {
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const hex = createHmac('sha256', secret).update(signed).digest('hex');
  return `sha256=${hex}`;
}

describe('verifyWorksuiteSignature', () => {
  const now = 1_776_816_000; // fixed clock (Unix seconds)
  const body = Buffer.from(
    '{"event":"contractor.updated","contractorId":"c1"}',
  );
  const ts = String(now);

  it('accepts a valid signature over the raw body', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts, 'a-different-secret-a-different!!'),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects when the raw body was altered after signing', () => {
    const sig = sign(body, ts);
    const tampered = Buffer.from(
      '{"event":"contractor.archived","contractorId":"c1"}',
    );
    expect(
      verifyWorksuiteSignature({
        rawBody: tampered,
        timestamp: ts,
        signature: sig,
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects a missing signature or timestamp', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        signature: sign(body, ts),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects a malformed (non-numeric) timestamp', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: 'not-a-number',
        signature: sign(body, ts),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects an expired (stale) timestamp beyond tolerance', () => {
    const staleTs = String(now - 3600);
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: staleTs,
        signature: sign(body, staleTs),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects a future timestamp beyond tolerance', () => {
    const futureTs = String(now + 3600);
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: futureTs,
        signature: sign(body, futureTs),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects a malformed signature format', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        signature: 'deadbeef',
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        signature: 'sha256=zz',
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it('rejects when the secret is empty or body is empty', () => {
    expect(
      verifyWorksuiteSignature({
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts),
        secret: '',
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      verifyWorksuiteSignature({
        rawBody: Buffer.alloc(0),
        timestamp: ts,
        signature: sign(Buffer.alloc(0), ts),
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: now,
      }),
    ).toBe(false);
  });
});
