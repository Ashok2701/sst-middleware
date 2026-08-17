import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped correlation context.
 *
 * Backed by Node's AsyncLocalStorage so the correlation id is available
 * ANYWHERE in the request lifecycle (services, guards, downstream clients)
 * without threading the `req` object through every call.
 *
 * This is intentionally the same "context propagation" model OpenTelemetry
 * uses, so a future OTel integration can wrap/replace this store cleanly
 * (e.g. deriving the correlation id from the active trace/span) without
 * changing call sites.
 */
export interface CorrelationStore {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

/** Returns the current correlation id, or undefined outside a request scope. */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
