export enum TransactionStatus {
  Started = 'STARTED',
  Retrying = 'RETRYING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
}

/**
 * Foundation record for an integration transaction. This is the basis for
 * later audit/support tooling. The persistence backend is NOT decided yet;
 * see TransactionStore for the pluggable abstraction.
 */
export interface IntegrationTransaction {
  transactionId: string;
  correlationId?: string;
  operationId?: string;
  sourceSystem?: string;
  targetSystem: string;
  operation: string;
  entityType?: string;
  entityId?: string;
  status: TransactionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  errorCode?: string;
}
