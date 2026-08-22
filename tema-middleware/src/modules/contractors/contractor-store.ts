import { Injectable } from '@nestjs/common';
import { Contractor } from './models/contractor.model';

/**
 * Pluggable persistence for synced TEMA contractor records.
 *
 * The final TEMA datastore is NOT decided yet (consistent with the existing
 * transaction/idempotency stores), so the default is in-memory. Swap this token
 * for a durable implementation once the datastore is approved - no call-site
 * changes required.
 */
export interface ContractorStore {
  upsert(contractor: Contractor): Promise<Contractor>;
  findById(id: string): Promise<Contractor | undefined>;
  setActive(id: string, active: boolean): Promise<Contractor | undefined>;
}

export const CONTRACTOR_STORE = Symbol('CONTRACTOR_STORE');

@Injectable()
export class InMemoryContractorStore implements ContractorStore {
  private readonly items = new Map<string, Contractor>();

  async upsert(contractor: Contractor): Promise<Contractor> {
    const stored: Contractor = { ...contractor };
    this.items.set(stored.worksuiteContractorId, stored);
    return { ...stored };
  }

  async findById(id: string): Promise<Contractor | undefined> {
    const found = this.items.get(id);
    return found ? { ...found } : undefined;
  }

  async setActive(
    id: string,
    active: boolean,
  ): Promise<Contractor | undefined> {
    const found = this.items.get(id);
    if (!found) return undefined;
    const updated: Contractor = {
      ...found,
      active,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return { ...updated };
  }
}
