import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { WorksuiteAdapter } from '../src/integrations/worksuite/worksuite.adapter';

const SECRET = 'e2e-ws-webhook-secret-e2e-ws-webhook-secret';

function sign(rawBody: string, ts: string, secret = SECRET): string {
  const signed = Buffer.concat([Buffer.from(`${ts}.`), Buffer.from(rawBody)]);
  return `sha256=${createHmac('sha256', secret).update(signed).digest('hex')}`;
}

describe('POST /api/webhooks/worksuite (e2e)', () => {
  let app: INestApplication;
  const getContractor = jest.fn();

  const worksuiteMock = {
    name: 'worksuite',
    targetSystem: 'WorkSuite',
    enabled: true,
    getContractor,
    checkConnectivity: jest.fn().mockResolvedValue({
      name: 'worksuite',
      targetSystem: 'WorkSuite',
      status: 'UP',
      enabled: true,
    }),
  };

  beforeAll(async () => {
    const saved = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: 'test',
      // Auth ENABLED to prove the webhook is public (HMAC-authenticated).
      AUTH_ENABLED: 'true',
      AUTH_PROVIDER: 'dev',
      AUTH_ISSUER: 'https://tema.test/',
      AUTH_AUDIENCE: 'tema-middleware',
      AUTH_DEV_SECRET: 'dev-secret-dev-secret-dev-secret-dev!!',
      RATE_LIMIT_ENABLED: 'false',
      WORKSUITE_ENABLED: 'true',
      WORKSUITE_WEBHOOK_ENABLED: 'true',
      WORKSUITE_WEBHOOK_SECRET: SECRET,
      WORKSUITE_WEBHOOK_TOLERANCE_SECONDS: '300',
      WORKSUITE_CONTRACTOR_PATH: '/partner/contractors/{id}',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WorksuiteAdapter)
      .useValue(worksuiteMock)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true, rawBody: true });
    setupApp(app);
    await app.init();
    process.env = saved;
  });

  afterAll(async () => await app.close());
  beforeEach(() => getContractor.mockReset());

  const ts = () => String(Math.floor(Date.now() / 1000));

  function post(body: string, ts: string, sig: string, eventId = 'evt-1') {
    return request(app.getHttpServer())
      .post('/api/webhooks/worksuite')
      .set('Content-Type', 'application/json')
      .set('x-worksuite-timestamp', ts)
      .set('x-worksuite-signature', sig)
      .set('x-worksuite-event-id', eventId)
      .send(body);
  }

  it('accepts a valid HMAC-signed created event and syncs (no bearer token)', async () => {
    getContractor.mockResolvedValue({
      id: 'c1',
      role: 'Technician',
      status: 'active',
    });
    const body = '{"event":"contractor.created","contractorId":"c1"}';
    const t = ts();
    const res = await post(body, t, sign(body, t), 'evt-created').expect(200);
    expect(res.body).toMatchObject({ accepted: true, status: 'processed' });
    expect(getContractor).toHaveBeenCalledWith('c1');
  });

  it('rejects an invalid signature (401) without syncing', async () => {
    const body = '{"event":"contractor.updated","contractorId":"c1"}';
    const t = ts();
    const res = await post(
      body,
      t,
      'sha256=' + '0'.repeat(64),
      'evt-bad',
    ).expect(401);
    expect(res.body.code).toBe('WEBHOOK_REJECTED');
    expect(getContractor).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header (401)', async () => {
    const body = '{"event":"contractor.updated","contractorId":"c1"}';
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/worksuite')
      .set('Content-Type', 'application/json')
      .set('x-worksuite-timestamp', ts())
      .set('x-worksuite-event-id', 'evt-nosig')
      .send(body)
      .expect(401);
    expect(res.body.code).toBe('WEBHOOK_REJECTED');
  });

  it('rejects an expired timestamp (401)', async () => {
    const body = '{"event":"contractor.updated","contractorId":"c1"}';
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    await post(body, stale, sign(body, stale), 'evt-stale').expect(401);
  });

  it('rejects when the raw body was tampered after signing (401)', async () => {
    const signedBody = '{"event":"contractor.updated","contractorId":"c1"}';
    const sentBody = '{"event":"contractor.archived","contractorId":"c1"}';
    const t = ts();
    await post(sentBody, t, sign(signedBody, t), 'evt-tamper').expect(401);
  });

  it('handles a duplicate event id idempotently (syncs once)', async () => {
    getContractor.mockResolvedValue({ id: 'c2', role: 'Technician' });
    const body = '{"event":"contractor.updated","contractorId":"c2"}';
    const t = ts();
    const sig = sign(body, t);
    await post(body, t, sig, 'evt-dup').expect(200);
    await post(body, t, sig, 'evt-dup').expect(200);
    expect(getContractor).toHaveBeenCalledTimes(1);
  });

  it('archived event disables access without pulling the record', async () => {
    const body = '{"event":"contractor.archived","contractorId":"c3"}';
    const t = ts();
    await post(body, t, sign(body, t), 'evt-arch').expect(200);
    expect(getContractor).not.toHaveBeenCalled();
  });

  it('safely rejects a malformed (non-JSON) payload with a 400 (no sync, no leak)', async () => {
    const body = 'not-json{';
    const t = ts();
    // Malformed JSON is rejected safely at the HTTP boundary with a generic
    // 400 before any contractor sync; the unit test covers the service-level
    // WEBHOOK_INVALID_PAYLOAD path directly with a raw buffer.
    const res = await post(body, t, sign(body, t), 'evt-malformed').expect(400);
    expect(getContractor).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(res.body).not.toHaveProperty('stack');
  });

  it('never leaks the webhook secret in an error response', async () => {
    const body = '{"event":"contractor.updated","contractorId":"c1"}';
    const res = await post(
      body,
      ts(),
      'sha256=' + '0'.repeat(64),
      'evt-leak',
    ).expect(401);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(res.body).not.toHaveProperty('stack');
  });

  it('preserves the correlation id', async () => {
    getContractor.mockResolvedValue({ id: 'c4', role: 'Technician' });
    const body = '{"event":"contractor.created","contractorId":"c4"}';
    const t = ts();
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/worksuite')
      .set('Content-Type', 'application/json')
      .set('x-worksuite-timestamp', t)
      .set('x-worksuite-signature', sign(body, t))
      .set('x-worksuite-event-id', 'evt-cid')
      .set('x-correlation-id', 'WS-CID-1')
      .send(body)
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('WS-CID-1');
  });

  it('keeps /health public and unaffected', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
