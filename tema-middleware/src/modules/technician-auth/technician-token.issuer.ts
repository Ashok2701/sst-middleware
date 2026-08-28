import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';
import { loginNotAvailable } from './technician-auth.errors';

export interface IssueTokenParams {
  subject: string;
  username: string;
  roles: string[];
  permissions: string[];
}

/**
 * Mints an HS256 JWT at login that is byte-compatible with the existing
 * verify-only DevJwtProvider (same secret, issuer, audience, `sub`, `roles`,
 * `permissions`, `preferred_username`). The returned token is therefore
 * accepted as-is by the global AuthGuard.
 *
 * TEMPORARY DEV BRIDGE: minting is gated to the `dev` provider in non-production
 * only. With OIDC / in production the real identity provider issues tokens, so
 * this endpoint returns a safe "login not available" error.
 */
@Injectable()
export class TechnicianTokenIssuer {
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
    if (!this.isAvailable()) throw loginNotAvailable();
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
