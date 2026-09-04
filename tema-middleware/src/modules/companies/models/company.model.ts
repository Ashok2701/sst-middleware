/**
 * Companies (== Crews) read models. Source: FSM.XCREW, joined to FSM.XTECHNCN
 * via XCREWID_0. READ-ONLY; no CRUD/DDL. The crew password (XPASSWRD_0) is
 * never selected or exposed. "Company" and "Crew" are the same entity here.
 */
export type SqlRow = Record<string, unknown>;

export interface Company {
  /** XCREWID_0 - crew/company id. */
  crewId: string;
  /** XCRENAM_0 - crew/company name. */
  name?: string;
  /** XFCY_0 - site/facility. */
  site?: string;
  /** Derived from XACTIVE_0 (Sage convention: 2 => Yes/active). */
  active?: boolean;
}

export interface CompanyTechnician {
  /** XTECH_0 - technician id. */
  technicianId: string;
  /** XTECHNAM_0 - technician name. */
  name?: string;
  /** XLEADTECH_0 === 2 => lead technician. */
  leadTechnician: boolean;
  /** XSKLTYP_0 - skill type. */
  skillType?: string;
  /** XCRTFCN_0 - certification. */
  certification?: string;
  /** XEMAIL_0 - email. */
  email?: string;
}

export interface CompanyDetail extends Company {
  technicians: CompanyTechnician[];
}
