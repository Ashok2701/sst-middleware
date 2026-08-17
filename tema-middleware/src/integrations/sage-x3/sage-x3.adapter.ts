import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SageX3Config } from '../../config/configuration';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import { IntegrationAdapter } from '../../common/integration/interfaces/integration-adapter.interface';
import {
  IntegrationHealth,
  IntegrationStatus,
} from '../../common/integration/models/integration-health';
import { SageX3Client } from './sage-x3.client';

/**
 * Sage X3 integration adapter.
 *
 * Foundation ONLY: identity + connectivity check + a low-level `call` that
 * delegates to the Sage client for FUTURE operation modules. It deliberately
 * exposes NO business operations (Purchase Receipt, Delivery, Payment, Job
 * Completion) because the Sage X3 Web Service contracts have not been provided.
 */
@Injectable()
export class SageX3Adapter implements IntegrationAdapter {
  readonly name = 'sage-x3';
  readonly targetSystem = 'Sage X3';

  private readonly logger = new Logger(SageX3Adapter.name);
  private readonly cfg: SageX3Config;

  constructor(
    config: ConfigService,
    private readonly client: SageX3Client,
  ) {
    this.cfg = config.get<SageX3Config>('sageX3')!;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  /** Non-sensitive descriptor safe for logs/health (never includes secrets). */
  describeTarget(): { baseUrl?: string; authType: string; enabled: boolean } {
    return {
      baseUrl: this.cfg.baseUrl,
      authType: this.cfg.authType,
      enabled: this.cfg.enabled,
    };
  }

  /** Low-level pass-through for future operation modules to build upon. */
  get call(): SageX3Client['request'] {
    return this.client.request.bind(this.client);
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
        `Sage X3 connectivity check failed [correlationId=${getCorrelationId()}]: ` +
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
