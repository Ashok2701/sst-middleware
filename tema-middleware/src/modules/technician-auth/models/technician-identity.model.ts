/**
 * Phase 3.5 - Technician / Lead Technician login models.
 *
 * Source: the existing Sage X3 / FSM technician table (`XTECHNCN`) in SQL
 * Server. The X3 column names below are FIXED by TEMA and use the exact `_0`
 * suffix. No additional X3 fields are invented; unknown ones stay PENDING.
 *
 * Sales Representatives are explicitly OUT OF SCOPE for this phase (different
 * Sage X3 table) and are never queried here.
 */
import { Company } from '../../companies/models/company.model';

/** Confirmed technician roles for this phase (no Sales Rep here). */
export enum TechnicianRole {
  LeadTechnician = 'Lead Technician',
  Technician = 'Technician',
}

/** Confirmed rule: XLEADTECH_0 = 2 => Lead Technician; otherwise Technician. */
export const LEAD_TECHNICIAN_INDICATOR = 2;

/** Minimal permission set for this phase (isolated / easy to change later).
 * The technician (FSM Mobile persona) needs read access to their crew/company,
 * service requests and routes; adjust here to change per-role access. */
export const TECHNICIAN_PERMISSIONS: readonly string[] = [
  'technician.read',
  'company.read',
  'serviceRequest.read',
  'route.read',
];

/** RAW row from the Sage X3 technician table. Exact X3 column names. */
export interface TechnicianLoginRow {
  /** XTECH_0 - stable X3 technician id. */
  XTECH_0?: unknown;
  /** XTECHNCN_0 - login username. */
  XTECHNCN_0?: unknown;
  /** XTECHNAM_0 - technician name. */
  XTECHNAM_0?: unknown;
  /** XCREWID_0 - crew/company id (links to FSM.XCREW). */
  XCREWID_0?: unknown;
  /** XPASSWRD_0 - stored password (TEMPORARY dev value; never exposed/logged). */
  XPASSWRD_0?: unknown;
  /** XLEADTECH_0 - lead technician indicator (2 => Lead Technician). */
  XLEADTECH_0?: unknown;
}

/** Canonical authenticated technician identity. Never carries the password. */
export interface TechnicianIdentity {
  technicianId: string;
  username: string;
  name?: string;
  crewId?: string;
  role: TechnicianRole;
}

export interface TechnicianLoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: TechnicianIdentity;
  /** The technician's crew/company (from FSM.XCREW via XCREWID_0), if resolved. */
  crew?: Company;
}
