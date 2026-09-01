/**
 * Phase 3.6 - Sales Representative login models.
 *
 * Source: Sage X3 `XX10CUSERS` (users) + `XX10CUSERD` (site assignments).
 * Exact X3 columns (verified): XAUS_0 (user/login), XPWSD_0 (password),
 * XAUSNA_0 (name), XEMAILID_0 (email), XACT_0 (active), XUSROLE_0 (role).
 * Sites: XX10CUSERD.XFCY_0 with XDEFFCY_0 marking the default site.
 *
 * This is a SEPARATE domain/auth model from technicians; only the secure
 * verification+token mechanism is shared.
 */

/** XUSROLE_0 = 1 identifies Sales Representatives. */
export const SALES_REP_ROLE_INDICATOR = 1;
/** XACT_0 = 1 means active. */
export const SALES_REP_ACTIVE_INDICATOR = 1;
/**
 * XDEFFCY_0 value that marks the default site. Sage local menus commonly use
 * 2 = Yes; PENDING confirmation - falls back to the first assigned site.
 */
export const SALES_REP_DEFAULT_SITE_FLAG = 2;

export const SALES_REP_ROLE = 'Sales Rep';
export const SALES_REP_PERMISSIONS: readonly string[] = ['salesrep.read'];

export interface SalesRepUserRow {
  XAUS_0?: unknown;
  XPWSD_0?: unknown;
  XAUSNA_0?: unknown;
  XEMAILID_0?: unknown;
  XACT_0?: unknown;
  XUSROLE_0?: unknown;
}

export interface SalesRepSiteRow {
  XFCY_0?: unknown;
  XDEFFCY_0?: unknown;
}

export interface SalesRepIdentity {
  salesRepId: string;
  username: string;
  name?: string;
  email?: string;
  role: string;
  sites: string[];
  defaultSite?: string;
}

export interface SalesRepLoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SalesRepIdentity;
}
