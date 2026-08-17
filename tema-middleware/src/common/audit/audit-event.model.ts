export enum AuditOutcome {
  Success = 'SUCCESS',
  Failure = 'FAILURE',
}

/**
 * Business audit event - answers who/what/when/which-entity/outcome.
 *
 * This is intentionally SEPARATE from technical logs (troubleshooting). Do not
 * put sensitive payloads here; keep only non-sensitive business facts.
 */
export interface AuditEvent {
  eventId: string;
  timestamp: string;
  /** Who performed the action (subject id / system). Optional until auth lands. */
  actor?: string;
  /** Business action, e.g. 'JOB_COMPLETED' (names defined in later phases). */
  action: string;
  entityType?: string;
  entityId?: string;
  sourceSystem?: string;
  targetSystem?: string;
  outcome: AuditOutcome;
  correlationId?: string;
  transactionId?: string;
  /** Non-sensitive metadata only. */
  metadata?: Record<string, unknown>;
}
