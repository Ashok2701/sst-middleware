import { Injectable } from '@nestjs/common';
import {
  Company,
  CompanyDetail,
  CompanyTechnician,
  SqlRow,
} from '../models/company.model';

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** Sage local-menu convention used across FSM: 2 => Yes. */
const SAGE_YES = 2;

/** Maps raw FSM.XCREW / FSM.XTECHNCN rows to safe Company DTOs (no password). */
@Injectable()
export class CompanyMapper {
  toCompany(row: SqlRow): Company {
    return {
      crewId: str(row.XCREWID_0) ?? '',
      name: str(row.XCRENAM_0),
      site: str(row.XFCY_0),
      active:
        row.XACTIVE_0 === null || row.XACTIVE_0 === undefined
          ? undefined
          : Number(row.XACTIVE_0) === SAGE_YES,
    };
  }

  toTechnician(row: SqlRow): CompanyTechnician {
    return {
      technicianId: str(row.XTECH_0) ?? '',
      name: str(row.XTECHNAM_0),
      leadTechnician: Number(row.XLEADTECH_0) === SAGE_YES,
      skillType: str(row.XSKLTYP_0),
      certification: str(row.XCRTFCN_0),
      email: str(row.XEMAIL_0),
    };
  }

  toDetail(crew: SqlRow, technicians: SqlRow[]): CompanyDetail {
    return {
      ...this.toCompany(crew),
      technicians: technicians.map((t) => this.toTechnician(t)),
    };
  }
}
