import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { IdempotencyService } from '../../common/integration/idempotency/idempotency.service';
import { InMemoryIdempotencyStore } from '../../common/integration/idempotency/idempotency-store';
import { WorksuiteConfig } from '../../config/configuration';
import { WorksuiteWebhookService } from './worksuite-webhook.service';
import { HmacWebhookAuthenticator } from './auth/webhook-authenticator';
import { buildEventAliases } from './worksuite-events';

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
      authMode: 'hmac-sha256',
      eventAliases: buildEventAliases({}),
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
    applyStatusChange: jest.fn().mockResolvedValue({}),
    applyProfileUpdate: jest.fn().mockResolvedValue({}),
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
    new HmacWebhookAuthenticator(configService),
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

  it('ignores an unknown/unsupported event type safely', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.unknown","contractorId":"c1"}',
    );
    const res = await service.handle(raw, headers(raw, 'evt-unk'));
    expect(res.status).toBe('ignored');
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
  });

  // ----- Phase 3.8: five logical events, partnerId, status/profile/company -----

  it('extracts WorkSuite partnerId (mapped to contractorId) on created', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.created","partnerId":"1405"}',
    );
    const res = await service.handle(raw, headers(raw, 'evt-partner'));
    expect(res).toMatchObject({ status: 'processed' });
    expect(contractors.syncFromWorksuite).toHaveBeenCalledWith(
      '1405',
      'WORKSUITE_CONTRACTOR_CREATED',
    );
  });

  it('ignores a created event with no partnerId (safe ack)', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from('{"event":"contractor.created"}');
    const res = await service.handle(raw, headers(raw, 'evt-nopartner'));
    expect(res.status).toBe('ignored');
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
  });

  it('activation/deactivation fetches latest via applyStatusChange', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from(
      '{"event":"contractor.deactivated","partnerId":"c5"}',
    );
    await service.handle(raw, headers(raw, 'evt-status'));
    expect(contractors.applyStatusChange).toHaveBeenCalledWith(
      'c5',
      'WORKSUITE_CONTRACTOR_STATUS_CHANGED',
    );
  });

  it('profile update fetches latest via applyProfileUpdate', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from('{"event":"profile.updated","partnerId":"c6"}');
    await service.handle(raw, headers(raw, 'evt-profile'));
    expect(contractors.applyProfileUpdate).toHaveBeenCalledWith(
      'c6',
      'WORKSUITE_CONTRACTOR_PROFILE_UPDATED',
    );
  });

  it('company update WITH partnerId syncs that single contractor', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from('{"event":"company.updated","partnerId":"c7"}');
    const res = await service.handle(raw, headers(raw, 'evt-company'));
    expect(res.status).toBe('processed');
    expect(contractors.syncFromWorksuite).toHaveBeenCalledWith(
      'c7',
      'WORKSUITE_COMPANY_UPDATED',
    );
  });

  it('company update WITHOUT partnerId is a safe TBD ack (no sync)', async () => {
    const { service, contractors, audit } = build(cfg());
    const raw = Buffer.from('{"event":"company.updated"}');
    const res = await service.handle(raw, headers(raw, 'evt-company-tbd'));
    expect(res.status).toBe('ignored');
    expect(contractors.syncFromWorksuite).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason: 'company_relationship_tbd',
        }),
      }),
    );
  });

  it('resolves configurable UPPER_SNAKE event strings case-insensitively', async () => {
    const { service, contractors } = build(cfg());
    const raw = Buffer.from('{"event":"CONTRACTOR_CREATED","partnerId":"c8"}');
    const res = await service.handle(raw, headers(raw, 'evt-upper'));
    expect(res.status).toBe('processed');
    expect(contractors.syncFromWorksuite).toHaveBeenCalledWith(
      'c8',
      'WORKSUITE_CONTRACTOR_CREATED',
    );
  });

  it('surfaces a WorkSuite Partner API failure and audits SYNC_FAILED', async () => {
    const { service, contractors, audit } = build(cfg());
    contractors.syncFromWorksuite.mockRejectedValueOnce(
      new Error('worksuite 5xx'),
    );
    const raw = Buffer.from('{"event":"contractor.created","partnerId":"c9"}');
    await expect(
      service.handle(raw, headers(raw, 'evt-apifail')),
    ).rejects.toThrow();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WORKSUITE_SYNC_FAILED' }),
    );
  });
});
