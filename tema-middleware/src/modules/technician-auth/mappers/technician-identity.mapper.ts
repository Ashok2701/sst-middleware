import { Injectable } from '@nestjs/common';
import {
  LEAD_TECHNICIAN_INDICATOR,
  TechnicianIdentity,
  TechnicianLoginRow,
  TechnicianRole,
} from '../models/technician-identity.model';

function toStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

/**
 * Maps a RAW Sage X3 technician row to the canonical identity + resolves the
 * role. Isolates the X3 column-name assumptions in ONE place. The stored
 * password (XPASSWRD_0) is deliberately NOT part of the identity and is only
 * read separately for verification - it is never exposed or returned.
 */
@Injectable()
export class TechnicianIdentityMapper {
  toIdentity(row: TechnicianLoginRow): TechnicianIdentity | undefined {
    const technicianId = toStr(row.XTECH_0);
    const username = toStr(row.XTECHNCN_0);
    if (!technicianId || !username) return undefined;
    return { technicianId, username, role: this.resolveRole(row.XLEADTECH_0) };
  }

  /** Confirmed rule: exactly 2 => Lead Technician; any other value => Technician. */
  resolveRole(indicator: unknown): TechnicianRole {
    return Number(indicator) === LEAD_TECHNICIAN_INDICATOR
      ? TechnicianRole.LeadTechnician
      : TechnicianRole.Technician;
  }

  /** Extracts the stored password value for verification only. */
  readStoredPassword(row: TechnicianLoginRow): string | undefined {
    return toStr(row.XPASSWRD_0);
  }
}
