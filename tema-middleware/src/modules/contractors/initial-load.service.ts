import { Injectable, Logger, NotImplementedException } from '@nestjs/common';

/**
 * Initial-load abstraction for the first-time contractor synchronization.
 *
 * Two agreed approaches are supported CONCEPTUALLY; the concrete implementation
 * is intentionally deferred:
 *
 *   Option A - Partner API batch: TEMA batch-fetches active contractors through
 *              the WorkSuite Partner API.
 *   Option B - CSV import: WorkSuite provides a CSV of the agreed contractor
 *              fields.
 *
 * PENDING: the batch API contract and the CSV column layout are NOT provided.
 * No CSV columns or API fields are invented. This service establishes the
 * service/model boundary so the chosen approach can be completed later without
 * architectural changes.
 */
@Injectable()
export class ContractorInitialLoadService {
  private readonly logger = new Logger(ContractorInitialLoadService.name);

  /** Option A - batch fetch via the WorkSuite Partner API. PENDING contract. */
  async loadFromPartnerApi(): Promise<never> {
    this.logger.warn(
      'Initial load (Partner API batch) invoked but the batch contract is pending',
    );
    throw new NotImplementedException({
      code: 'INITIAL_LOAD_NOT_CONFIGURED',
      message:
        'WorkSuite initial-load (Partner API batch) is pending the WorkSuite contract',
    });
  }

  /** Option B - CSV import. PENDING the agreed column layout. */
  async importFromCsv(csv: string): Promise<never> {
    this.logger.warn(
      `Initial load (CSV import) invoked (bytes=${csv?.length ?? 0}) but the ` +
        'CSV column layout is pending',
    );
    throw new NotImplementedException({
      code: 'INITIAL_LOAD_NOT_CONFIGURED',
      message:
        'WorkSuite initial-load (CSV import) is pending the WorkSuite column layout',
    });
  }
}
