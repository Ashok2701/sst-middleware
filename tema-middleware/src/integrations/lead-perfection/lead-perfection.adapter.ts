import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadPerfectionConfig } from '../../config/configuration';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import { IntegrationAdapter } from '../../common/integration/interfaces/integration-adapter.interface';
import {
  IntegrationHealth,
  IntegrationStatus,
} from '../../common/integration/models/integration-health';
import { LeadPerfectionClient } from './lead-perfection.client';

/**
 * Lead Perfection integration adapter (Phase 3.6 foundation).
 *
 * Establishes identity + authenticated connectivity + safe error handling. Read
 * operations will be added as the actual Lead Perfection API contract is
 * provided - nothing is invented here.
 */
@Injectable()
export class LeadPerfectionAdapter implements IntegrationAdapter {
  readonly name = 'lead-perfection';
  readonly targetSystem = 'LeadPerfection';

  private readonly logger = new Logger(LeadPerfectionAdapter.name);
  private readonly cfg: LeadPerfectionConfig;

  constructor(
    config: ConfigService,
    private readonly client: LeadPerfectionClient,
  ) {
    this.cfg = config.get<LeadPerfectionConfig>('leadPerfection')!;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
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
      await this.client.get(this.cfg.healthPath, 'checkConnectivity');
      return {
        name: this.name,
        targetSystem: this.targetSystem,
        status: IntegrationStatus.Up,
        enabled: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.warn(
        `LeadPerfection connectivity check failed [correlationId=${getCorrelationId()}]: ` +
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
