import {
  WorksuiteApiAuthType,
  WorksuiteConfig,
} from '../../config/configuration';

/**
 * WorkSuite Partner API authentication abstraction.
 *
 * PENDING: the exact WorkSuite Partner API authentication mechanism and
 * credentials have NOT been provided. This supports the common standards-based
 * options (none / Bearer token / API-key header) and is fully configurable so
 * the correct one can be plugged in later WITHOUT changing the client/adapter.
 *
 * Credentials are applied to outbound headers only and are NEVER logged.
 */
export interface WorksuiteAuthProvider {
  readonly type: WorksuiteApiAuthType;
  applyAuthHeaders(headers: Record<string, string>): Record<string, string>;
}

class NoAuthProvider implements WorksuiteAuthProvider {
  readonly type: WorksuiteApiAuthType = 'none';
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return headers;
  }
}

class BearerAuthProvider implements WorksuiteAuthProvider {
  readonly type: WorksuiteApiAuthType = 'bearer';
  constructor(private readonly token: string) {}
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return { ...headers, Authorization: `Bearer ${this.token}` };
  }
}

class ApiKeyAuthProvider implements WorksuiteAuthProvider {
  readonly type: WorksuiteApiAuthType = 'apikey';
  constructor(
    private readonly headerName: string,
    private readonly apiKey: string,
  ) {}
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return { ...headers, [this.headerName]: this.apiKey };
  }
}

export function createWorksuiteAuthProvider(
  cfg: WorksuiteConfig,
): WorksuiteAuthProvider {
  switch (cfg.apiAuthType) {
    case 'bearer':
      return new BearerAuthProvider(cfg.apiToken ?? '');
    case 'apikey':
      return new ApiKeyAuthProvider(cfg.apiKeyHeader, cfg.apiKey ?? '');
    case 'none':
    default:
      return new NoAuthProvider();
  }
}
