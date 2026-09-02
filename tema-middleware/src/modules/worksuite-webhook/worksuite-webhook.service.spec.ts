import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { IdempotencyService } from '../../common/integration/idempotency/idempotency.service';
import { InMemoryIdempotencyStore } from '../../common/integration/idempotency/idempotency-store';
import { WorksuiteConfig } from '../../config/configuration';
import { WorksuiteWebhookService } from './worksuite-webhook.service';

const SECRET = 'ws-webhook-secret-ws-webhook-secret';

function cfg(
  partial: Partial<WorksuiteConfig['webhook']> = {},
): WorksuiteConfig {
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
      secret: SECRET,
      toleranceSeconds: 300,
      ...partial,
    },
    password: { algorithm: 'PBKDF2-SHA256' },
  };
}

function sign(raw: Buffer, ts: string): string {
  const signed = Buffer.concat([Buffer.from(`${ts}.`), raw]);
  return `sha256=${createHmac('sha256', SECRET).update(signed).digest('hex')}`;
}

function build(config: WorksuiteConfig) {
  const contractors = {
    syncFromWorksuite: jest.fn().mockResolvedValue({}),
    archive: jest.fn().mockResolvedValue(undefined),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
  const idempotency = new IdempotencyService(new InMemoryIdempotencyStore());
  const configService = { get: () => config } as unknown as ConfigService;
  const service = new WorksuiteWebhookService(
    configService,
    idempotency,
    contractors,
    audit,
  );
  return { service, contractors, audit };
}

describe('WorksuiteWebhookService', () => {
  const ts = String(Math.floor(Date.now() / 1000));

  function headers(raw: Buffer, eventId = 'evt-1') {
    return { timestamp: ts, signature: sign(raw, ts), eventId };
  }

  it('rejects a webhook when processing is disabled', async () => {
    const { service } = build(cfg({ enabled: false }));
    await expect(service.handle(Buffer.from('{}'), {})).rejects.toMatchObject({
      response: { code: 'WEBHOOK_DISABLED' },
    });
  });

  it('rejects and audits an invalid signature', async () => {
    const { service, audit, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.updated","contractorId":"c1"}',
    );
    await expect(
      service.handle(raw, {
        timestamp: ts,
        signature: 'sha256=' + '0'.repeat(64),
        eventId: 'e',
      }),
    ).rejects.toMatchObject({ response: { code: 'WEBHOOK_REJECTED' } });
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WORKSUITE_WEBHOOK_REJECTED' }),
    );
  });

  it('rejects when the event id header is missing', async () => {
    const { service } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.updated","contractorId":"c1"}',
    );
    await expect(
      service.handle(raw, { timestamp: ts, signature: sign(raw, ts) }),
    ).rejects.toMatchObject({ response: { code: 'WEBHOOK_REJECTED' } });
  });

  it('processes contractor.created via fetch-and-sync', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.created","contractorId":"c1"}',
    );
    const res = await service.handle(raw, headers(raw));
    expect(res).toMatchObject({
      accepted: true,
      status: 'processed',
      event: 'contractor.created',
    });
    expect(contractors.syncFromWorksuite).toHaveBeenCalledWith(
      'c1',
      'WORKSUITE_CONTRACTOR_CREATED',
    );
  });

  it('processes contractor.archived without pulling the record', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.archived","contractorId":"c9"}',
    );
    await service.handle(raw, headers(raw, 'evt-arch'));
    expect(contractors.archive).toHaveBeenCalledWith(
      'c9',
      'WORKSUITE_CONTRACTOR_ARCHIVED',
    );
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
  });

  it('reactivate forces active sync', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.reactivated","contractorId":"c2"}',
    );
    await service.handle(raw, headers(raw, 'evt-react'));
    expect(contractors.syncFromWorksuite).toHaveBeenCalledWith(
      'c2',
      'WORKSUITE_CONTRACTOR_REACTIVATED',
      true,
    );
  });

  it('is idempotent: a duplicate event id is processed only once', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.updated","contractorId":"c1"}',
    );
    const h = headers(raw, 'evt-dup');
    await service.handle(raw, h);
    await service.handle(raw, h);
    expect(contractors.syncFromWorksuite).toHaveBeenCalledTimes(1);
  });

  it('releases the idempotency key on failure so retry can reprocess', async () => {
    const { service, contractors, audit } = build(cfg());
    contractors.syncFromWorksuite
      .mockRejectedValueOnce(new Error('downstream'))
      .mockResolvedValueOnce({});
    const raw = Buffer.from(
      '{"event":"contractor.updated","contractorId":"c1"}',
    );
    const h = headers(raw, 'evt-retry');
    await expect(service.handle(raw, h)).rejects.toThrow();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WORKSUITE_SYNC_FAILED' }),
    );
    await expect(service.handle(raw, h)).resolves.toMatchObject({
      status: 'processed',
    });
    expect(contractors.syncFromWorksuite).toHaveBeenCalledTimes(2);
  });

  it('ignores an unknown event type safely', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.unknown","contractorId":"c1"}',
    );
    const res = await service.handle(raw, headers(raw, 'evt-unk'));
    expect(res.status).toBe('ignored');
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
  });

  it('rejects a malformed (non-JSON) payload after a valid signature', async () => {
    const { service, contractors, audit } = build(cfg());
    const raw = Buffer.from('not-json{');
    await expect(
      service.handle(raw, headers(raw, 'evt-bad-json')),
    ).rejects.toMatchObject({
      response: { code: 'WEBHOOK_INVALID_PAYLOAD' },
    });
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WORKSUITE_WEBHOOK_REJECTED',
        metadata: expect.objectContaining({ reason: 'invalid_payload' }),
      }),
    );
  });
});
