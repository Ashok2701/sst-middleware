import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getCorrelationId } from '../correlation/correlation.context';
import { AuditEvent, AuditOutcome } from './audit-event.model';

/**
 * Pluggable audit destination. Default writes to a dedicated logger stream so
 * business audit is separable from technical logs. A durable sink can be added
 * later (once the datastore is approved) without touching call sites.
 */
export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');

@Injectable()
export class LoggingAuditSink implements AuditSink {
  private readonly logger = new Logger('Audit');

  async record(event: AuditEvent): Promise<void> {
    // Tagged so audit lines can be routed/filtered separately from tech logs.
    this.logger.log({ audit: true, ...event });
  }
}

export interface RecordAuditInput {
  action: string;
  outcome: AuditOutcome;
  actor?: string;
  entityType?: string;
  entityId?: string;
  sourceSystem?: string;
  targetSystem?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_SINK) private readonly sink: AuditSink) {}

  async record(input: RecordAuditInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId: getCorrelationId(),
      ...input,
    };
    await this.sink.record(event);
    return event;
  }
}
