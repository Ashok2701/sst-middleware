import { Injectable } from '@nestjs/common';
import {
  SALES_REP_ACTIVE_INDICATOR,
  SALES_REP_DEFAULT_SITE_FLAG,
  SALES_REP_ROLE,
  SALES_REP_ROLE_INDICATOR,
  SalesRepIdentity,
  SalesRepSiteRow,
  SalesRepUserRow,
} from '../models/sales-rep-identity.model';

function toStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

/** Maps raw XX10CUSERS/XX10CUSERD rows to the canonical Sales Rep identity. */
@Injectable()
export class SalesRepMapper {
  /** Only role=1 AND active=1 sales reps may receive TEMA access. */
  isEligible(user: SalesRepUserRow): boolean {
    return (
      Number(user.XUSROLE_0) === SALES_REP_ROLE_INDICATOR &&
      Number(user.XACT_0) === SALES_REP_ACTIVE_INDICATOR
    );
  }

  readStoredPassword(user: SalesRepUserRow): string | undefined {
    return toStr(user.XPWSD_0);
  }

  toIdentity(
    user: SalesRepUserRow,
    siteRows: SalesRepSiteRow[],
  ): SalesRepIdentity | undefined {
    const id = toStr(user.XAUS_0);
    if (!id) return undefined;

    const sites = siteRows
      .map((r) => toStr(r.XFCY_0))
      .filter((s): s is string => !!s);
    const defaultRow = siteRows.find(
      (r) => Number(r.XDEFFCY_0) === SALES_REP_DEFAULT_SITE_FLAG,
    );
    const defaultSite = toStr(defaultRow?.XFCY_0) ?? sites[0];

    return {
      salesRepId: id,
      username: id,
      name: toStr(user.XAUSNA_0),
      email: toStr(user.XEMAILID_0),
      role: SALES_REP_ROLE,
      sites,
      defaultSite,
    };
  }
}
