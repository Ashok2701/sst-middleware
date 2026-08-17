/** Inbound request passed to an integration adapter's `execute`. */
export interface IntegrationRequest<TPayload = unknown> {
  /** Logical operation name (e.g. 'checkConnectivity', 'getCustomerById'). */
  operation: string;
  /** Correlation id for tracing (usually taken from the request context). */
  correlationId?: string;
  /** Optional finer-grained operation id. */
  operationId?: string;
  /** Optional integration transaction id this call belongs to. */
  transactionId?: string;
  /** Optional idempotency key for de-duplicating client retries. */
  idempotencyKey?: string;
  /** Per-call timeout override in milliseconds. */
  timeoutMs?: number;
  /** Operation-specific payload (adapter defines the shape). */
  payload?: TPayload;
  /** Non-sensitive metadata. */
  metadata?: Record<string, unknown>;
}
