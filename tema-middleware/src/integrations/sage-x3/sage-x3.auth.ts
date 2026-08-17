import { SageAuthType, SageX3Config } from '../../config/configuration';

/**
 * Sage X3 authentication abstraction.
 *
 * The actual Sage X3 Web Service authentication mechanism has NOT been provided.
 * This supports the common standards-based options (none / HTTP Basic / API key
 * header) and is fully configurable, so the correct one can be selected once the
 * client confirms it - without changing the client/adapter code.
 *
 * Credentials are applied to outbound headers only and are never logged.
 */
export interface SageAuthProvider {
  readonly type: SageAuthType;
  applyAuthHeaders(headers: Record<string, string>): Record<string, string>;
}

class NoAuthProvider implements SageAuthProvider {
  readonly type: SageAuthType = 'none';
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return headers;
  }
}

class BasicAuthProvider implements SageAuthProvider {
  readonly type: SageAuthType = 'basic';
  constructor(
    private readonly username: string,
    private readonly password: string,
  ) {}
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    const token = Buffer.from(`${this.username}:${this.password}`).toString(
      'base64',
    );
    return { ...headers, Authorization: `Basic ${token}` };
  }
}

class ApiKeyAuthProvider implements SageAuthProvider {
  readonly type: SageAuthType = 'apikey';
  constructor(
    private readonly headerName: string,
    private readonly apiKey: string,
  ) {}
  applyAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return { ...headers, [this.headerName]: this.apiKey };
  }
}

export function createSageAuthProvider(cfg: SageX3Config): SageAuthProvider {
  switch (cfg.authType) {
    case 'basic':
      return new BasicAuthProvider(cfg.username ?? '', cfg.password ?? '');
    case 'apikey':
      return new ApiKeyAuthProvider(cfg.apiKeyHeader, cfg.apiKey ?? '');
    case 'none':
    default:
      return new NoAuthProvider();
  }
}
