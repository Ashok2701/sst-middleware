import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { WorksuiteConfig } from '../../config/configuration';
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

export interface WorksuiteRequestOptions<T> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: unknown;
  headers?: Record<string, string>;
  operation: string;
  timeoutMs?: number;
  /** Optional response validator; failure -> TRANSFORMATION_ERROR. */
  validate?: (data: unknown) => data is T;
  /** Retry policy for THIS call. Defaults to NO_RETRY (writes not repeatable). */
  retry?: RetryPolicy;
}

/**
 * Reusable HTTP client for the WorkSuite Partner API.
 *
 * Mirrors the Sage X3 client: configurable base URL + timeout, correlation-id
 * propagation, pluggable auth (headers), structured logging, safe error mapping,
 * response validation and retry hooks.
 *
 * NEVER logs credentials, tokens, api keys, auth headers, passwords, password
 * hashes, or full payload bodies.
 */
@Injectable()
export class WorksuiteClient {
  private readonly logger = new Logger(WorksuiteClient.name);
  private readonly cfg: WorksuiteConfig;
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly applyAuthHeaders: (
      h: Record<string, string>,
    ) => Record<string, string>,
  ) {
    this.cfg = config.get<WorksuiteConfig>('worksuite')!;
    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs,
    });
  }

  async request<T = unknown>(options: WorksuiteRequestOptions<T>): Promise<T> {
    if (!this.cfg.enabled) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'WorkSuite',
        operation: options.operation,
        message: 'WorkSuite integration is disabled',
      });
    }
    if (!this.cfg.baseUrl) {
      throw new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR, {
        targetSystem: 'WorkSuite',
        operation: options.operation,
        message: 'WorkSuite base URL is not configured',
      });
    }

    const correlationId = getCorrelationId();
    const policy = options.retry ?? NO_RETRY;

    return executeWithRetry(
      () => this.doRequest<T>(options, correlationId),
      policy,
      (attempt, _error, delayMs) =>
        this.logger.warn(
          `WorkSuite retry attempt=${attempt} op=${options.operation} ` +
            `delayMs=${delayMs} correlationId=${correlationId}`,
        ),
    );
  }

  private async doRequest<T>(
    options: WorksuiteRequestOptions<T>,
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
        `WorkSuite ${options.method} ${options.path} status=${response.status} ` +
          `durationMs=${durationMs} correlationId=${correlationId}`,
      );

      if (options.validate && !options.validate(response.data)) {
        throw new IntegrationError(IntegrationErrorCode.TRANSFORMATION_ERROR, {
          targetSystem: 'WorkSuite',
          operation: options.operation,
          message: 'WorkSuite response failed validation',
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
      `WorkSuite error op=${operation} status=${status ?? 'n/a'} ` +
        `driverCode=${axiosErr?.code ?? 'n/a'} mapped=${code} ` +
        `correlationId=${correlationId}`,
    );

    return new IntegrationError(code, {
      targetSystem: 'WorkSuite',
      operation,
      cause: error,
      internalDetails: { status, driverCode: axiosErr?.code },
    });
  }
}
