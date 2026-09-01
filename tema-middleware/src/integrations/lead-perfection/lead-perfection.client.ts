import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { LeadPerfectionConfig } from '../../config/configuration';
import { CORRELATION_ID_HEADER } from '../../common/correlation/correlation.constants';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../common/integration/errors/integration-error';

/**
 * Reusable HTTP client for the Lead Perfection API (Phase 3.6 foundation).
 *
 * Config-driven base URL, API-key header auth, timeout, correlation-id
 * propagation, structured logging (no secrets) and safe error mapping. Concrete
 * operations are PENDING the provided API contract - no endpoints are invented.
 */
@Injectable()
export class LeadPerfectionClient {
  private readonly logger = new Logger(LeadPerfectionClient.name);
  private readonly cfg: LeadPerfectionConfig;
  private readonly http: AxiosInstance;

  constructor(config: ConfigService) {
    this.cfg = config.get<LeadPerfectionConfig>('leadPerfection')!;
    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs,
    });
  }

  /** Side-effect-free GET against a caller-provided (config-derived) path. */
  async get<T = unknown>(path: string, operation: string): Promise<T> {
    if (!this.cfg.enabled) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'LeadPerfection',
        operation,
        message: 'Lead Perfection integration is disabled',
      });
    }
    if (!this.cfg.baseUrl) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'LeadPerfection',
        operation,
        message: 'Lead Perfection base URL is not configured',
      });
    }
    const correlationId = getCorrelationId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
    };
    if (this.cfg.apiKey) headers[this.cfg.apiKeyHeader] = this.cfg.apiKey;

    const start = Date.now();
    try {
      const res = await this.http.get(path, { headers });
      this.logger.log(
        `LeadPerfection GET ${path} status=${res.status} ` +
          `durationMs=${Date.now() - start} correlationId=${correlationId}`,
      );
      return res.data as T;
    } catch (error) {
      throw this.mapError(error, operation, correlationId);
    }
  }

  private mapError(
    error: unknown,
    operation: string,
    correlationId?: string,
  ): IntegrationError {
    const e = error as { response?: { status?: number }; code?: string };
    const status = e?.response?.status;
    let code = IntegrationErrorCode.UNKNOWN_INTEGRATION_ERROR;
    if (e?.code === 'ECONNABORTED') code = IntegrationErrorCode.TIMEOUT_ERROR;
    else if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(e?.code ?? ''))
      code = IntegrationErrorCode.CONNECTION_ERROR;
    else if (status === 401) code = IntegrationErrorCode.AUTHENTICATION_ERROR;
    else if (status === 403) code = IntegrationErrorCode.AUTHORIZATION_ERROR;
    else if (status === 429) code = IntegrationErrorCode.RATE_LIMIT_ERROR;
    else if (status !== undefined && status >= 500)
      code = IntegrationErrorCode.REMOTE_SYSTEM_ERROR;

    this.logger.warn(
      `LeadPerfection error op=${operation} status=${status ?? 'n/a'} ` +
        `mapped=${code} correlationId=${correlationId}`,
    );
    return new IntegrationError(code, {
      targetSystem: 'LeadPerfection',
      operation,
      cause: error,
      internalDetails: { status, driverCode: e?.code },
    });
  }
}
