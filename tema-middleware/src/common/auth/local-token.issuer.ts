import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';

export interface IssueTokenParams {
  subject: string;
  username: string;
  roles: string[];
  permissions: string[];
}

/** Safe error reused for both technician and sales-rep local login. */
export function localLoginNotAvailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'INTEGRATION_NOT_CONFIGURED',
    message:
      'Local login is not available for the current authentication provider',
  });
}

/**
 * Shared dev-bridge token issuer for local (SQL-backed) logins.
 *
 * Mints an HS256 JWT byte-compatible with the existing verify-only
 * DevJwtProvider (same secret, issuer, audience, `sub`, `roles`, `permissions`,
 * `preferred_username`) so the token is accepted by the global AuthGuard.
 *
 * TEMPORARY: gated to the `dev` provider in non-production only. With OIDC /
 * production the real IdP issues tokens, so callers receive a safe error.
 */
@Injectable()
export class LocalTokenIssuer {
  private readonly cfg: AuthConfig;
  private readonly nodeEnv: string;

  constructor(config: ConfigService) {
    this.cfg = config.get<AuthConfig>('auth')!;
    this.nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  }

  isAvailable(): boolean {
    return (
      this.cfg.provider === 'dev' &&
      this.nodeEnv !== 'production' &&
      !!this.cfg.devSecret &&
      this.cfg.devSecret.length >= 32 &&
      !!this.cfg.issuer &&
      !!this.cfg.audience
    );
  }

  issue(params: IssueTokenParams): { token: string; expiresIn: number } {
    if (!this.isAvailable()) throw localLoginNotAvailable();
    const ttl = this.cfg.tokenTtlSeconds;
    const token = jwt.sign(
      {
        preferred_username: params.username,
        roles: params.roles,
        permissions: params.permissions,
      },
      this.cfg.devSecret!,
      {
        algorithm: 'HS256',
        issuer: this.cfg.issuer,
        audience: this.cfg.audience,
        subject: params.subject,
        expiresIn: ttl,
      },
    );
    return { token, expiresIn: ttl };
  }
}
