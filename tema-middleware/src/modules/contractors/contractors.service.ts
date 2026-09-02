import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { AuditOutcome } from '../../common/audit/audit-event.model';
import { WorksuiteAdapter } from '../../integrations/worksuite/worksuite.adapter';
import { CONTRACTOR_STORE, ContractorStore } from './contractor-store';
import { ContractorMapper } from './mappers/contractor.mapper';
import {
  Contractor,
  StoredCredential,
  WorksuiteContractorPayload,
} from './models/contractor.model';
import { WorksuitePasswordVerifier } from './password/password-verifier';

/**
 * Contractor synchronization service. Applies the WorkSuite
 * notification-and-pull lifecycle onto the canonical TEMA contractor store:
 *
 *   - CREATE / UPDATE / REACTIVATE -> fetch current record via the Partner API
 *     adapter, map to canonical, upsert (active). Password reset arrives as an
 *     UPDATE (new hash synchronized here).
 *   - ARCHIVE -> disable TEMA access (deactivate) without a Partner API fetch;
 *     the webhook payload does not carry the full record.
 *
 * Controllers never call the adapter/store directly; they go through here.
 */
@Injectable()
export class ContractorsService {
  private readonly logger = new Logger(ContractorsService.name);

  constructor(
    private readonly adapter: WorksuiteAdapter,
    private readonly mapper: ContractorMapper,
    @Inject(CONTRACTOR_STORE) private readonly store: ContractorStore,
    private readonly passwordVerifier: WorksuitePasswordVerifier,
    private readonly audit: AuditService,
  ) {}

  /** Fetch-and-sync a contractor (create/update/reactivate). */
  async syncFromWorksuite(
    contractorId: string,
    action: string,
    forceActive = false,
  ): Promise<Contractor> {
    const payload = (await this.adapter.getContractor(
      contractorId,
    )) as WorksuiteContractorPayload;
    const canonical = this.mapper.toCanonical(payload, contractorId);
    if (forceActive) canonical.active = true;

    const saved = await this.store.upsert(canonical);
    await this.audit.record({
      action,
      outcome: AuditOutcome.Success,
      entityType: 'Contractor',
      entityId: saved.worksuiteContractorId,
      sourceSystem: 'WorkSuite',
      targetSystem: 'TEMA',
      // Safe metadata only - never credential/hash/secret material.
      metadata: {
        role: saved.role,
        active: saved.active,
        hasCredential: Boolean(saved.credential),
      },
    });
    this.logger.log(
      `Contractor synced action=${action} id=${saved.worksuiteContractorId} active=${saved.active}`,
    );
    return saved;
  }

  /**
   * Activation / deactivation (Phase 3.8): fetch the latest record and apply
   * WorkSuite's current status via the standard fetch-map-upsert. Status values
   * are NOT invented here - the mapper owns the (configurable) status mapping.
   */
  async applyStatusChange(
    contractorId: string,
    action: string,
  ): Promise<Contractor> {
    return this.syncFromWorksuite(contractorId, action);
  }

  /**
   * Profile update (Phase 3.8): fetch the latest record and merge onto the
   * existing contractor, PRESERVING fields the source did not supply. A profile
   * update never changes activation status (that is a status-change event), and
   * empty/undefined incoming values do not clear existing values.
   */
  async applyProfileUpdate(
    contractorId: string,
    action: string,
  ): Promise<Contractor> {
    const payload = (await this.adapter.getContractor(
      contractorId,
    )) as WorksuiteContractorPayload;
    const incoming = this.mapper.toCanonical(payload, contractorId);
    const existing = await this.store.findById(contractorId);
    const merged = existing ? mergeContractor(existing, incoming) : incoming;

    const saved = await this.store.upsert(merged);
    await this.audit.record({
      action,
      outcome: AuditOutcome.Success,
      entityType: 'Contractor',
      entityId: saved.worksuiteContractorId,
      sourceSystem: 'WorkSuite',
      targetSystem: 'TEMA',
      metadata: {
        role: saved.role,
        active: saved.active,
        created: !existing,
        hasCredential: Boolean(saved.credential),
      },
    });
    this.logger.log(
      `Contractor profile updated action=${action} id=${saved.worksuiteContractorId} created=${!existing}`,
    );
    return saved;
  }

  /** Archive -> disable TEMA FSM access. */
  async archive(contractorId: string, action: string): Promise<void> {
    await this.store.setActive(contractorId, false);
    await this.audit.record({
      action,
      outcome: AuditOutcome.Success,
      entityType: 'Contractor',
      entityId: contractorId,
      sourceSystem: 'WorkSuite',
      targetSystem: 'TEMA',
      metadata: { active: false },
    });
    this.logger.log(`Contractor archived id=${contractorId}`);
  }

  findById(id: string): Promise<Contractor | undefined> {
    return this.store.findById(id);
  }

  /** Local verification of a contractor password against the stored hash. */
  async verifyPassword(
    credential: StoredCredential,
    plaintext: string,
  ): Promise<boolean> {
    return this.passwordVerifier.verify(plaintext, credential);
  }
}

/**
 * Merges an incoming (freshly-fetched) contractor onto the existing record for
 * a PROFILE update: incoming values win only when present; empty/undefined
 * incoming values preserve the existing value; activation status is preserved
 * (changed only by status-change events).
 */
function mergeContractor(
  existing: Contractor,
  incoming: Contractor,
): Contractor {
  return {
    worksuiteContractorId: incoming.worksuiteContractorId,
    partnerId: incoming.partnerId ?? existing.partnerId,
    companyId: incoming.companyId ?? existing.companyId,
    role: incoming.role ?? existing.role,
    active: existing.active,
    country: incoming.country ?? existing.country,
    crew: incoming.crew ?? existing.crew,
    credential: incoming.credential ?? existing.credential,
    updatedAt: incoming.updatedAt,
  };
}
