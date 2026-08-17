import { IntegrationErrorCode } from '../errors/integration-error';

/** Normalised result returned from an integration adapter's `execute`. */
export interface IntegrationResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: { code: IntegrationErrorCode; message: string };
  durationMs: number;
  targetSystem: string;
  operation: string;
  correlationId?: string;
}
