import { Injectable } from '@nestjs/common';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../../common/integration/errors/integration-error';
import {
  Contractor,
  ContractorRole,
  CONFIRMED_ROLES,
  StoredCredential,
  WorksuiteContractorPayload,
} from '../models/contractor.model';

function toStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function firstDefined(
  source: WorksuiteContractorPayload,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

/**
 * Maps a RAW WorkSuite contractor payload to the TEMA canonical contractor.
 *
 * Isolates all WorkSuite field-name assumptions in ONE place. The physical
 * WorkSuite field names are PENDING; the candidate keys below are read
 * defensively so the real field names can be added later without touching the
 * webhook/sync services. Only confirmed canonical fields are populated - no
 * Branch/Region, no invented fields.
 */
@Injectable()
export class ContractorMapper {
  toCanonical(
    payload: WorksuiteContractorPayload,
    fallbackId?: string,
  ): Contractor {
    if (!payload || typeof payload !== 'object') {
      throw new IntegrationError(IntegrationErrorCode.TRANSFORMATION_ERROR, {
        targetSystem: 'WorkSuite',
        operation: 'mapContractor',
        message: 'WorkSuite contractor payload is not an object',
      });
    }

    const id =
      toStr(
        firstDefined(payload, ['worksuiteContractorId', 'contractorId', 'id']),
      ) ?? (fallbackId ? String(fallbackId) : undefined);

    if (!id) {
      throw new IntegrationError(IntegrationErrorCode.TRANSFORMATION_ERROR, {
        targetSystem: 'WorkSuite',
        operation: 'mapContractor',
        message: 'WorkSuite contractor payload is missing an id',
      });
    }

    return {
      worksuiteContractorId: id,
      partnerId: toStr(firstDefined(payload, ['partnerId', 'partner_id'])),
      companyId: toStr(firstDefined(payload, ['companyId', 'company_id'])),
      role: this.mapRole(firstDefined(payload, ['role', 'partnerUserRole'])),
      active: this.mapActive(
        firstDefined(payload, ['active', 'status', 'eligibility']),
      ),
      country: this.mapCountry(
        firstDefined(payload, ['country', 'countryCode']),
      ),
      crew: toStr(firstDefined(payload, ['crew'])),
      credential: this.mapCredential(payload),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Normalizes country to the confirmed USA / Canada values where recognisable. */
  private mapCountry(value: unknown): string | undefined {
    const s = toStr(value);
    if (!s) return undefined;
    const u = s.toUpperCase();
    if (['USA', 'US', 'UNITED STATES'].includes(u)) return 'USA';
    if (['CANADA', 'CA', 'CAN'].includes(u)) return 'Canada';
    return s;
  }

  /** Only the four confirmed role values are accepted; anything else -> undefined. */
  private mapRole(value: unknown): ContractorRole | undefined {
    const s = toStr(value);
    if (!s) return undefined;
    return CONFIRMED_ROLES.has(s) ? (s as ContractorRole) : undefined;
  }

  private mapActive(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const s = toStr(value)?.toLowerCase();
    if (!s) return true;
    // Treat explicit inactive/archived states as inactive; default to active.
    return !['false', 'inactive', 'archived', 'disabled', '0'].includes(s);
  }

  /**
   * Extracts the hashed credential if WorkSuite supplied one. The exact stored
   * hash format is PENDING; hashing params fall back to configuration when the
   * payload does not carry them. Plaintext is never accepted here.
   */
  private mapCredential(
    payload: WorksuiteContractorPayload,
  ): StoredCredential | undefined {
    const hash = toStr(
      firstDefined(payload, ['credentialHash', 'passwordHash', 'hash']),
    );
    if (!hash) return undefined;
    return {
      algorithm:
        toStr(firstDefined(payload, ['passwordAlgorithm', 'algorithm'])) ??
        'PBKDF2-SHA256',
      hash,
      salt: toStr(firstDefined(payload, ['passwordSalt', 'salt'])),
      iterations: toInt(firstDefined(payload, ['iterations'])),
      keyLength: toInt(firstDefined(payload, ['keyLength'])),
      encoding: toStr(firstDefined(payload, ['encoding'])),
    };
  }
}
