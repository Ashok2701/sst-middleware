import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { SageX3Config } from '../../config/configuration';
import { CORRELATION_ID_HEADER } from '../../common/correlation/correlation.constants';
import { getCorrelationId } from '../../common/correlation/correlation.context';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../common/integration/errors/integration-error';
import {
  executeWithRetry,
  NO_RETRY,
  RetryPolicy,
} from '../../common/integration/policies/retry.policy';

export interface SageRequestOptions<T> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: unknown;
  headers?: Record<string, string>;
  operation: string;
  timeoutMs?: number;
  /** Optional response validator; failure -> TRANSFORMATION_ERROR. */
  validate?: (data: unknown) => data is T;
  /**
   * Retry policy for THIS call. Defaults to NO_RETRY because many Sage
   * business transactions are not safe to repeat. Callers opt into retries
   * explicitly (e.g. safe reads).
   */
  retry?: RetryPolicy;
}

/**
 * Reusable HTTP client for the Sage X3 Web Service.
 *
 * Isolates all Sage-specific HTTP details from TEMA core. Provides: configurable
 * base URL + timeout, correlation-id propagation, auth abstraction (headers),
 * structured logging, safe error mapping, response validation and retry hooks.
 *
 * NEVER logs credentials, tokens, api keys, auth headers, or full payload bodies.
 */
@Injectable()
export class SageX3Client {
  private readonly logger = new Logger(SageX3Client.name);
  private readonly cfg: SageX3Config;
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly applyAuthHeaders: (
      h: Record<string, string>,
    ) => Record<string, string>,
  ) {
    this.cfg = config.get<SageX3Config>('sageX3')!;
    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs,
    });
  }

  async request<T = unknown>(options: SageRequestOptions<T>): Promise<T> {
    if (!this.cfg.enabled) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'Sage X3',
        operation: options.operation,
        message: 'Sage X3 integration is disabled',
      });
    }
    if (!this.cfg.baseUrl) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'Sage X3',
        operation: options.operation,
        message: 'Sage X3 base URL is not configured',
      });
    }

    const correlationId = getCorrelationId();
    const policy = options.retry ?? NO_RETRY;

    return executeWithRetry(
      () => this.doRequest<T>(options, correlationId),
      policy,
      (attempt, _error, delayMs) =>
        this.logger.warn(
          `Sage X3 retry attempt=${attempt} op=${options.operation} ` +
            `delayMs=${delayMs} correlationId=${correlationId}`,
        ),
    );
  }

  private async doRequest<T>(
    options: SageRequestOptions<T>,
    correlationId?: string,
  ): Promise<T> {
    const start = Date.now();
    const headers = this.applyAuthHeaders({
      Accept: 'application/json',
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
      ...(options.headers ?? {}),
    });

    const requestConfig: AxiosRequestConfig = {
      method: options.method,
      url: options.path,
      data: options.data,
      headers,
      timeout: options.timeoutMs ?? this.cfg.timeoutMs,
    };

    try {
      const response = await this.http.request(requestConfig);
      const durationMs = Date.now() - start;
      // Structured log - method, path, status, timing, correlation. No bodies.
      this.logger.log(
        `Sage X3 ${options.method} ${options.path} status=${response.status} ` +
          `durationMs=${durationMs} correlationId=${correlationId}`,
      );

      if (options.validate && !options.validate(response.data)) {
        throw new IntegrationError(IntegrationErrorCode.TRANSFORMATION_ERROR, {
          targetSystem: 'Sage X3',
          operation: options.operation,
          message: 'Sage X3 response failed validation',
        });
      }
      return response.data as T;
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw this.mapError(error, options.operation, correlationId);
    }
  }

  private mapError(
    error: unknown,
    operation: string,
    correlationId?: string,
  ): IntegrationError {
    const axiosErr = error as {
      response?: { status?: number };
      code?: string;
      message?: string;
    };
    const status = axiosErr?.response?.status;
    let code = IntegrationErrorCode.UNKNOWN_INTEGRATION_ERROR;

    if (axiosErr?.code === 'ECONNABORTED') {
      code = IntegrationErrorCode.TIMEOUT_ERROR;
    } else if (
      axiosErr?.code === 'ECONNREFUSED' ||
      axiosErr?.code === 'ENOTFOUND' ||
      axiosErr?.code === 'EAI_AGAIN'
    ) {
      code = IntegrationErrorCode.CONNECTION_ERROR;
    } else if (status === 401) {
      code = IntegrationErrorCode.AUTHENTICATION_ERROR;
    } else if (status === 403) {
      code = IntegrationErrorCode.AUTHORIZATION_ERROR;
    } else if (status === 429) {
      code = IntegrationErrorCode.RATE_LIMIT_ERROR;
    } else if (status === 400 || status === 422) {
      code = IntegrationErrorCode.REMOTE_VALIDATION_ERROR;
    } else if (status !== undefined && status >= 500) {
      code = IntegrationErrorCode.REMOTE_SYSTEM_ERROR;
    }

    this.logger.warn(
      `Sage X3 error op=${operation} status=${status ?? 'n/a'} ` +
        `driverCode=${axiosErr?.code ?? 'n/a'} mapped=${code} ` +
        `correlationId=${correlationId}`,
    );

    return new IntegrationError(code, {
      targetSystem: 'Sage X3',
      operation,
      cause: error,
      internalDetails: { status, driverCode: axiosErr?.code },
    });
  }
}
