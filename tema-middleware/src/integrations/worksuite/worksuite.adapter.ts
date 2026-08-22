import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorksuiteConfig } from '../../config/configuration';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../common/integration/errors/integration-error';
import { IntegrationAdapter } from '../../common/integration/interfaces/integration-adapter.interface';
import {
  IntegrationHealth,
  IntegrationStatus,
} from '../../common/integration/models/integration-health';
import { RetryPolicy } from '../../common/integration/policies/retry.policy';
import { WorksuiteClient } from './worksuite.client';

/**
 * WorkSuite Partner API integration adapter.
 *
 * Foundation ONLY: identity + connectivity check + a config-driven
 * `getContractor(id)` used by the notification-and-pull webhook flow. It returns
 * the RAW Partner API payload (mapping happens in a dedicated mapper).
 *
 * PENDING: the real Partner API base URL, authentication and the contractor
 * resource path are NOT provided. The contractor path is supplied via
 * configuration (`WORKSUITE_CONTRACTOR_PATH`, with a `{id}` placeholder); until
 * configured, `getContractor` fails safely - no endpoint/field names invented.
 */
@Injectable()
export class WorksuiteAdapter implements IntegrationAdapter {
  readonly name = 'worksuite';
  readonly targetSystem = 'WorkSuite';

  private readonly logger = new Logger(WorksuiteAdapter.name);
  private readonly cfg: WorksuiteConfig;

  constructor(
    config: ConfigService,
    private readonly client: WorksuiteClient,
  ) {
    this.cfg = config.get<WorksuiteConfig>('worksuite')!;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  /** Non-sensitive descriptor safe for logs/health (never includes secrets). */
  describeTarget(): {
    baseUrl?: string;
    apiAuthType: string;
    enabled: boolean;
  } {
    return {
      baseUrl: this.cfg.baseUrl,
      apiAuthType: this.cfg.apiAuthType,
      enabled: this.cfg.enabled,
    };
  }

  /**
   * Retrieves the current contractor record from the WorkSuite Partner API.
   * Reads are side-effect-free, so a bounded retry policy is applied.
   * Returns the raw payload; callers map it via the dedicated mapper.
   */
  async getContractor(contractorId: string): Promise<unknown> {
    const template = this.cfg.contractorPathTemplate;
    if (!template) {
      // Fail safely until the real Partner API contractor path is provided.
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: this.targetSystem,
        operation: 'getContractor',
        message: 'WorkSuite contractor path is not configured',
      });
    }
    const path = template.replace('{id}', encodeURIComponent(contractorId));
    const retry: RetryPolicy = {
      maxAttempts: this.cfg.retryMaxAttempts,
      initialDelayMs: this.cfg.retryInitialDelayMs,
      maxDelayMs: this.cfg.retryInitialDelayMs * 8,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrorCodes: [
        IntegrationErrorCode.CONNECTION_ERROR,
        IntegrationErrorCode.TIMEOUT_ERROR,
        IntegrationErrorCode.RATE_LIMIT_ERROR,
      ],
    };
    return this.client.request({
      method: 'GET',
      path,
      operation: 'getContractor',
      retry,
    });
  }

  async checkConnectivity(): Promise<IntegrationHealth> {
    if (!this.cfg.enabled) {
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Disabled,
        enabled: false,
        message: 'Integration disabled',
      };
    }
    const start = Date.now();
    try {
      await this.client.request({
        method: 'GET',
        path: this.cfg.healthPath,
        operation: 'checkConnectivity',
      });
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Up,
        enabled: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.warn(
        `WorkSuite connectivity check failed [correlationId=${getCorrelationId()}]: ` +
          `${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Down,
        enabled: true,
        latencyMs: Date.now() - start,
        message: 'Connectivity check failed',
      };
    }
  }
}
