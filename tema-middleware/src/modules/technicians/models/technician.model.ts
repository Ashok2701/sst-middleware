/**
 * Canonical TEMA technician model returned to consumers (e.g. TEMA Scheduling).
 *
 * Only `technicianId` is guaranteed. Every other field is OPTIONAL because the
 * actual SQL Server schema has not yet been provided - fields are populated only
 * when present in the (configuration-supplied) source. No fields are invented.
 */
export interface Technician {
  technicianId: string;
  name?: string;
  status?: string;
  branch?: string;
  region?: string;
  crew?: string;
  skills?: string[];
}

/**
 * Raw row shape returned by the SQL source. The source query/stored procedure
 * is expected to ALIAS its columns to these canonical names, decoupling TEMA
 * from the (still-unknown) physical column names.
 */
export interface TechnicianRow {
  technicianId?: unknown;
  name?: unknown;
  status?: unknown;
  branch?: unknown;
  region?: unknown;
  crew?: unknown;
  skills?: unknown;
}
