export enum IntegrationStatus {
  Up = 'UP',
  Down = 'DOWN',
  Disabled = 'DISABLED',
}

/** Connectivity/health snapshot for a single integration adapter. */
export interface IntegrationHealth {
  name: string;
  targetSystem: string;
  status: IntegrationStatus;
  enabled: boolean;
  latencyMs?: number;
  /** Safe, non-sensitive message (never a connection string or credential). */
  message?: string;
}
