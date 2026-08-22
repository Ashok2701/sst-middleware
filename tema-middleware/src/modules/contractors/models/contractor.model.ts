/**
 * Canonical TEMA contractor model + WorkSuite raw payload shapes.
 *
 * SCOPE: contains ONLY fields confirmed by the current requirements. Ferguson
 * confirmed Branch and Region are NOT required, so they are intentionally
 * absent. The final contractor field list is still PENDING SafeStep/WorkSuite
 * confirmation - additional confirmed fields can be added here + in the mapper
 * without redesigning the integration. No WorkSuite field names are invented.
 */

/** Confirmed WorkSuite Partner-User role values. A contractor holds ONE role. */
export enum ContractorRole {
  LeadTechnician = 'Lead Technician',
  Technician = 'Technician',
  SalesRep = 'Sales Rep',
  /** Exists in WorkSuite but must NOT receive TEMA username/password access. */
  NA = 'N/A',
}

export const CONFIRMED_ROLES: ReadonlySet<string> = new Set<string>([
  ContractorRole.LeadTechnician,
  ContractorRole.Technician,
  ContractorRole.SalesRep,
  ContractorRole.NA,
]);

/**
 * Hashed contractor credential as received from WorkSuite (source of truth).
 * TEMA stores the HASH only and performs local verification. Plaintext is
 * never stored or logged.
 *
 * PENDING: the exact stored-hash format (iterations, salt/key length, encoding)
 * is not confirmed by WorkSuite, so fields are optional and config-driven.
 */
export interface StoredCredential {
  algorithm: string;
  hash: string;
  salt?: string;
  iterations?: number;
  keyLength?: number;
  encoding?: string;
}

/** Canonical TEMA contractor. Only `worksuiteContractorId` is guaranteed. */
export interface Contractor {
  worksuiteContractorId: string;
  /** Partner/company association where provided by WorkSuite. */
  partnerId?: string;
  companyId?: string;
  role?: ContractorRole;
  /** Active/eligibility status; archived contractors are inactive. */
  active: boolean;
  /** Crew, only when confirmed by the final field specification. */
  crew?: string;
  /** Hashed credential; NEVER exposed via any API. */
  credential?: StoredCredential;
  updatedAt: string;
}

/**
 * A contractor may hold TEMA username/password access only when active AND the
 * role is one of the access-bearing roles (i.e. not N/A). This is the current
 * confirmed design; the final role -> permission mapping remains PENDING.
 */
export function isEligibleForTemaAccess(contractor: Contractor): boolean {
  return contractor.active && contractor.role !== ContractorRole.NA;
}

/**
 * RAW contractor payload retrieved from the WorkSuite Partner API. The physical
 * WorkSuite field names are PENDING; the mapper reads defensively from the
 * expected concepts and is the ONLY place that must change when the real field
 * names arrive. Kept as an index type so unknown fields are simply ignored.
 */
export interface WorksuiteContractorPayload {
  [key: string]: unknown;
}
