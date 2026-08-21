import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../common/integration/interfaces/mapper.interface';
import { Technician, TechnicianRow } from '../models/technician.model';

function toStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

/**
 * Maps a source row (columns aliased to canonical names) to the TEMA canonical
 * technician model. Defensive: only maps fields that are present; `skills`
 * accepts either an array or a comma-separated string.
 *
 * SQL source field -> TEMA canonical field -> Scheduler response field
 *   (source aliases)     technicianId/name/status/branch/region/crew/skills
 * The physical SQL column names are PENDING the actual schema.
 */
@Injectable()
export class TechnicianMapper implements Mapper<Technician, TechnicianRow> {
  toCanonical(row: TechnicianRow): Technician {
    return {
      technicianId: String(row.technicianId ?? ''),
      name: toStr(row.name),
      status: toStr(row.status),
      branch: toStr(row.branch),
      region: toStr(row.region),
      crew: toStr(row.crew),
      skills: this.mapSkills(row.skills),
    };
  }

  toExternal(canonical: Technician): TechnicianRow {
    return {
      technicianId: canonical.technicianId,
      name: canonical.name,
      status: canonical.status,
      branch: canonical.branch,
      region: canonical.region,
      crew: canonical.crew,
      skills: canonical.skills,
    };
  }

  private mapSkills(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const parts = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.length ? parts : undefined;
    }
    return undefined;
  }
}
