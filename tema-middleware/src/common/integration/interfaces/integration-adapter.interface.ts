import { IntegrationHealth } from '../models/integration-health';
import { IntegrationRequest } from '../models/integration-request';
import { IntegrationResult } from '../models/integration-result';

/**
 * Base contract every integration adapter implements.
 *
 * Deliberately minimal - it does NOT assume every backend behaves identically.
 * It only guarantees identity + a connectivity check. Concrete adapters expose
 * their own strongly-typed operations (e.g. the SQL adapter has query/proc
 * methods; the Sage client has request()), which suits heterogeneous backends.
 */
export interface IntegrationAdapter {
  /** Stable adapter id, e.g. 'sql-server'. */
  readonly name: string;
  /** Human-readable target system, e.g. 'SQL Server'. */
  readonly targetSystem: string;
  /** Whether this integration is enabled via configuration. */
  readonly enabled: boolean;
  /** Non-throwing connectivity probe (returns DISABLED when not enabled). */
  checkConnectivity(): Promise<IntegrationHealth>;
}

/**
 * Optional extension for adapters that fit a uniform request/response model.
 * Adapters whose operations do not fit this shape simply do not implement it.
 */
export interface ExecutableIntegrationAdapter<
  TReq = unknown,
  TRes = unknown,
> extends IntegrationAdapter {
  execute(request: IntegrationRequest<TReq>): Promise<IntegrationResult<TRes>>;
}
