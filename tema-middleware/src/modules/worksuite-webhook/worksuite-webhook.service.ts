import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service';
import { AuditOutcome } from '../../common/audit/audit-event.model';
import { IdempotencyService } from '../../common/integration/idempotency/idempotency.service';
import { WorksuiteConfig } from '../../config/configuration';
import { ContractorsService } from '../contractors/contractors.service';
import {
  webhookDisabled,
  webhookInvalidPayload,
  webhookNotConfigured,
  webhookRejected,
} from './worksuite-webhook.errors';
import { verifyWorksuiteSignature } from './signature/worksuite-signature';

export const WORKSUITE_WEBHOOK_HEADERS = {
  timestamp: 'x-worksuite-timestamp',
  signature: 'x-worksuite-signature',
  eventId: 'x-worksuite-event-id',
} as const;

/** Confirmed WorkSuite contractor lifecycle events. */
export enum WorksuiteEventType {
  Created = 'contractor.created',
  Updated = 'contractor.updated',
  Archived = 'contractor.archived',
  Reactivated = 'contractor.reactivated',
}

export interface WebhookHeaders {
  timestamp?: string;
  signature?: string;
  eventId?: string;
}

export interface WebhookResult {
  accepted: boolean;
  eventId: string;
  event: string;
  status: 'processed' | 'ignored';
}

/**
 * Orchestrates inbound WorkSuite webhooks (notification-and-pull):
 *   1. gate on config, 2. verify HMAC over the RAW body + timestamp freshness,
 *   3. require an event id, 4. parse safely, 5. apply Event-Id idempotency
 *   (reusing the Phase 2 IdempotencyService), 6. fetch the current contractor
 *   via the Partner API adapter and sync, 7. audit. Password reset and role
 *   change arrive as `contractor.updated`.
 *
 * Never logs the secret, signature, passwords, hashes or full payloads.
 */
@Injectable()
export class WorksuiteWebhookService {
  private readonly logger = new Logger(WorksuiteWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly contractors: ContractorsService,
    private readonly audit: AuditService,
  ) {}

  async handle(
    rawBody: Buffer | undefined,
    headers: WebhookHeaders,
  ): Promise<WebhookResult> {
    const cfg = this.config.get<WorksuiteConfig>('worksuite')!;

    if (!cfg.webhook.enabled) throw webhookDisabled();
    if (!cfg.webhook.secret) {
      await this.rejectAudit('secret_not_configured', headers.eventId);
      throw webhookNotConfigured();
    }

    const verified = verifyWorksuiteSignature({
      rawBody: rawBody ?? Buffer.alloc(0),
      timestamp: headers.timestamp,
      signature: headers.signature,
      secret: cfg.webhook.secret,
      toleranceSeconds: cfg.webhook.toleranceSeconds,
    });
    if (!verified) {
      await this.rejectAudit('signature_invalid', headers.eventId);
      throw webhookRejected();
    }

    // Event ID is required as the stable idempotency key across retries.
    const eventId = headers.eventId?.trim();
    if (!eventId) {
      await this.rejectAudit('missing_event_id');
      throw webhookRejected();
    }

    const parsed = this.parseBody(rawBody!);
    if (!parsed) {
      await this.rejectAudit('invalid_payload', eventId);
      throw webhookInvalidPayload();
    }

    const { eventType, contractorId } = parsed;

    // Idempotent processing keyed on the WorkSuite event id. Completed events
    // replay the stored result; a failure releases the key for safe retry.
    return this.idempotency.execute(eventId, () =>
      this.process(eventType, contractorId, eventId),
    );
  }

  private async process(
    eventType: string | undefined,
    contractorId: string | undefined,
    eventId: string,
  ): Promise<WebhookResult> {
    const done = (status: 'processed' | 'ignored'): WebhookResult => ({
      accepted: true,
      eventId,
      event: eventType ?? 'unknown',
      status,
    });

    if (!contractorId) {
      // Nothing actionable without a contractor id; acknowledge and ignore.
      this.logger.warn(
        `WorkSuite webhook missing contractor id eventId=${eventId}`,
      );
      return done('ignored');
    }

    try {
      switch (eventType) {
        case WorksuiteEventType.Created:
          await this.contractors.syncFromWorksuite(
            contractorId,
            'WORKSUITE_CONTRACTOR_CREATED',
          );
          return done('processed');
        case WorksuiteEventType.Updated:
          await this.contractors.syncFromWorksuite(
            contractorId,
            'WORKSUITE_CONTRACTOR_UPDATED',
          );
          return done('processed');
        case WorksuiteEventType.Reactivated:
          await this.contractors.syncFromWorksuite(
            contractorId,
            'WORKSUITE_CONTRACTOR_REACTIVATED',
            true,
          );
          return done('processed');
        case WorksuiteEventType.Archived:
          await this.contractors.archive(
            contractorId,
            'WORKSUITE_CONTRACTOR_ARCHIVED',
          );
          return done('processed');
        default:
          this.logger.warn(
            `WorkSuite webhook unknown event=${eventType} eventId=${eventId}`,
          );
          return done('ignored');
      }
    } catch (error) {
      await this.audit.record({
        action: 'WORKSUITE_SYNC_FAILED',
        outcome: AuditOutcome.Failure,
        entityType: 'Contractor',
        entityId: contractorId,
        sourceSystem: 'WorkSuite',
        targetSystem: 'TEMA',
        metadata: { event: eventType, eventId },
      });
      throw error;
    }
  }

  /**
   * Parses the RAW body AFTER signature verification and extracts the event
   * type and contractor id. Physical WorkSuite payload field names are PENDING;
   * candidate keys are read defensively.
   */
  private parseBody(
    rawBody: Buffer,
  ): { eventType?: string; contractorId?: string } | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (!json || typeof json !== 'object') return null;

    const eventType = firstString(json, ['event', 'type', 'eventType']);
    const data = (json.data ?? json.contractor ?? {}) as Record<
      string,
      unknown
    >;
    const contractorId =
      firstString(json, ['contractorId', 'contractor_id', 'id']) ??
      firstString(data, ['contractorId', 'contractor_id', 'id']);

    return { eventType, contractorId };
  }

  private async rejectAudit(reason: string, eventId?: string): Promise<void> {
    await this.audit.record({
      action: 'WORKSUITE_WEBHOOK_REJECTED',
      outcome: AuditOutcome.Failure,
      sourceSystem: 'WorkSuite',
      targetSystem: 'TEMA',
      // Safe metadata only - reason + event id; never secret/signature/body.
      metadata: { reason, eventId },
    });
  }
}

function firstString(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      const s = String(value).trim();
      if (s.length) return s;
    }
  }
  return undefined;
}
