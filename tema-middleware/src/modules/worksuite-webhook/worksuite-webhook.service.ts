import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service';
import { AuditOutcome } from '../../common/audit/audit-event.model';
import { IdempotencyService } from '../../common/integration/idempotency/idempotency.service';
import { WorksuiteConfig } from '../../config/configuration';
import { ContractorsService } from '../contractors/contractors.service';
import {
  WEBHOOK_AUTHENTICATOR,
  WebhookAuthenticator,
} from './auth/webhook-authenticator';
import { resolveLogicalEvent, WorksuiteLogicalEvent } from './worksuite-events';
import {
  webhookDisabled,
  webhookInvalidPayload,
  webhookNotConfigured,
  webhookRejected,
} from './worksuite-webhook.errors';

export const WORKSUITE_WEBHOOK_HEADERS = {
  timestamp: 'x-worksuite-timestamp',
  signature: 'x-worksuite-signature',
  eventId: 'x-worksuite-event-id',
} as const;

/** Audit action per logical event. Safe, non-sensitive labels only. */
const AUDIT_ACTIONS: Record<WorksuiteLogicalEvent, string> = {
  [WorksuiteLogicalEvent.ContractorCreated]: 'WORKSUITE_CONTRACTOR_CREATED',
  [WorksuiteLogicalEvent.ContractorUpdated]: 'WORKSUITE_CONTRACTOR_UPDATED',
  [WorksuiteLogicalEvent.ContractorStatusChanged]:
    'WORKSUITE_CONTRACTOR_STATUS_CHANGED',
  [WorksuiteLogicalEvent.ProfileUpdated]:
    'WORKSUITE_CONTRACTOR_PROFILE_UPDATED',
  [WorksuiteLogicalEvent.CompanyUpdated]: 'WORKSUITE_COMPANY_UPDATED',
  [WorksuiteLogicalEvent.ContractorArchived]: 'WORKSUITE_CONTRACTOR_ARCHIVED',
  [WorksuiteLogicalEvent.ContractorReactivated]:
    'WORKSUITE_CONTRACTOR_REACTIVATED',
};

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
 * Orchestrates inbound WorkSuite webhooks (notification-and-pull, Phase 3.8):
 *   1. gate on config, 2. authenticate via the pluggable WebhookAuthenticator
 *   (TEMPORARY HMAC over the RAW body), 3. require an event id, 4. parse safely
 *   + extract WorkSuite `partnerId` (mapped internally to contractorId),
 *   5. apply Event-Id idempotency (Phase 2 IdempotencyService), 6. resolve the
 *   raw event to a config-driven logical event, 7. dispatch to a small handler,
 *   8. audit + return a safe response.
 *
 * WorkSuite is the source of truth: TEMA only pulls the latest contractor via
 * the Partner API adapter and upserts locally - there is NO push back to
 * WorkSuite. Never logs the secret, signature, passwords, hashes or full bodies.
 */
@Injectable()
export class WorksuiteWebhookService {
  private readonly logger = new Logger(WorksuiteWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly contractors: ContractorsService,
    private readonly audit: AuditService,
    @Inject(WEBHOOK_AUTHENTICATOR)
    private readonly authenticator: WebhookAuthenticator,
  ) {}

  async handle(
    rawBody: Buffer | undefined,
    headers: WebhookHeaders,
  ): Promise<WebhookResult> {
    const cfg = this.config.get<WorksuiteConfig>('worksuite')!;

    if (!cfg.webhook.enabled) throw webhookDisabled();
    if (!this.authenticator.isConfigured()) {
      await this.rejectAudit('secret_not_configured', headers.eventId);
      throw webhookNotConfigured();
    }

    const authenticated = this.authenticator.verify({
      rawBody: rawBody ?? Buffer.alloc(0),
      timestamp: headers.timestamp,
      signature: headers.signature,
    });
    if (!authenticated) {
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

    const { rawEvent, contractorId } = parsed;
    const logical = resolveLogicalEvent(rawEvent, cfg.webhook.eventAliases);

    // Idempotent processing keyed on the WorkSuite event id. Completed events
    // replay the stored result; a failure releases the key for safe retry.
    return this.idempotency.execute(eventId, () =>
      this.process(logical, rawEvent, contractorId, eventId),
    );
  }

  /**
   * Dispatches a resolved logical event to its handler. Each branch is a thin
   * delegation to the contractor domain service (fetch latest from WorkSuite +
   * map + upsert); no business logic lives inline.
   */
  private async process(
    logical: WorksuiteLogicalEvent | undefined,
    rawEvent: string | undefined,
    contractorId: string | undefined,
    eventId: string,
  ): Promise<WebhookResult> {
    const done = (status: 'processed' | 'ignored'): WebhookResult => ({
      accepted: true,
      eventId,
      event: rawEvent ?? 'unknown',
      status,
    });

    if (!logical) {
      this.logger.warn(
        `WorkSuite webhook unsupported event=${rawEvent ?? 'n/a'} eventId=${eventId}`,
      );
      return done('ignored');
    }

    if (!contractorId) {
      if (logical === WorksuiteLogicalEvent.CompanyUpdated) {
        // Company events may not carry a partner id; the company->contractor
        // relationship is NOT confirmed by WorkSuite (TBD). Acknowledge safely.
        await this.rejectAudit('company_relationship_tbd', eventId, true);
        return done('ignored');
      }
      this.logger.warn(
        `WorkSuite webhook missing partnerId event=${logical} eventId=${eventId}`,
      );
      return done('ignored');
    }

    const handlers: Record<WorksuiteLogicalEvent, () => Promise<void>> = {
      [WorksuiteLogicalEvent.ContractorCreated]: () =>
        this.contractors
          .syncFromWorksuite(contractorId, AUDIT_ACTIONS[logical])
          .then(() => undefined),
      [WorksuiteLogicalEvent.ContractorUpdated]: () =>
        this.contractors
          .syncFromWorksuite(contractorId, AUDIT_ACTIONS[logical])
          .then(() => undefined),
      [WorksuiteLogicalEvent.ContractorStatusChanged]: () =>
        this.contractors
          .applyStatusChange(contractorId, AUDIT_ACTIONS[logical])
          .then(() => undefined),
      [WorksuiteLogicalEvent.ProfileUpdated]: () =>
        this.contractors
          .applyProfileUpdate(contractorId, AUDIT_ACTIONS[logical])
          .then(() => undefined),
      [WorksuiteLogicalEvent.CompanyUpdated]: () =>
        // partnerId present: sync that single contractor. Broader
        // company->contractor fan-out remains TBD pending WorkSuite.
        this.contractors
          .syncFromWorksuite(contractorId, AUDIT_ACTIONS[logical])
          .then(() => undefined),
      [WorksuiteLogicalEvent.ContractorArchived]: () =>
        this.contractors.archive(contractorId, AUDIT_ACTIONS[logical]),
      [WorksuiteLogicalEvent.ContractorReactivated]: () =>
        this.contractors
          .syncFromWorksuite(contractorId, AUDIT_ACTIONS[logical], true)
          .then(() => undefined),
    };

    try {
      await handlers[logical]();
      return done('processed');
    } catch (error) {
      await this.audit.record({
        action: 'WORKSUITE_SYNC_FAILED',
        outcome: AuditOutcome.Failure,
        entityType: 'Contractor',
        entityId: contractorId,
        sourceSystem: 'WorkSuite',
        targetSystem: 'TEMA',
        metadata: { event: logical, eventId },
      });
      throw error;
    }
  }

  /**
   * Parses the RAW body AFTER authentication and extracts the raw event string
   * and the WorkSuite `partnerId` (mapped internally to contractorId). WorkSuite
   * calls the identifier `partnerId`; legacy `contractorId`/`id` keys are also
   * read defensively. No numeric/casing assumptions are made.
   */
  private parseBody(
    rawBody: Buffer,
  ): { rawEvent?: string; contractorId?: string } | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (!json || typeof json !== 'object') return null;

    const rawEvent = firstString(json, ['event', 'type', 'eventType']);
    const data = (json.data ?? json.contractor ?? {}) as Record<
      string,
      unknown
    >;
    const contractorId =
      firstString(json, [
        'partnerId',
        'partner_id',
        'contractorId',
        'contractor_id',
        'id',
      ]) ??
      firstString(data, [
        'partnerId',
        'partner_id',
        'contractorId',
        'contractor_id',
        'id',
      ]);

    return { rawEvent, contractorId };
  }

  private async rejectAudit(
    reason: string,
    eventId?: string,
    accepted = false,
  ): Promise<void> {
    await this.audit.record({
      action: 'WORKSUITE_WEBHOOK_REJECTED',
      outcome: accepted ? AuditOutcome.Success : AuditOutcome.Failure,
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
