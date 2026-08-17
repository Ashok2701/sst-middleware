import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SERVICE_NAME } from '../common/constants';
import { HealthResponse, ReadinessResponse } from './health.dto';

/**
 * Liveness & readiness logic.
 *
 * Phase 1 has no external dependencies, so readiness is always true once the
 * app has started. The `ready` flag / `checks` array are the extension point
 * where future dependency probes (DB, Sage, FSM, message bus) will register.
 */
@Injectable()
export class HealthService {
  private ready = true;

  getLiveness(): HealthResponse {
    return { status: 'UP', service: SERVICE_NAME };
  }

  getReadiness(): ReadinessResponse {
    if (!this.ready) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is not ready to receive traffic',
      });
    }
    return { status: 'READY', service: SERVICE_NAME, checks: [] };
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }
}
