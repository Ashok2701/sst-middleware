import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';
import {
  AuthenticatedUser,
  IdentityProvider,
  TokenVerificationError,
} from './auth.types';
import { mapClaimsToUser } from './claims.mapper';

/**
 * DEVELOPMENT / TEST identity provider (HS256).
 *
 * - Enabled ONLY via configuration and NEVER in production (double-guarded).
 * - Validates signature (HS256 only), issuer, audience and expiry.
 * - Uses a configured secret; never real client credentials.
 *
 * This is not a production auth mechanism - it exists so automated tests and
 * local development can exercise authentication without a real provider.
 */
export class DevJwtProvider implements IdentityProvider {
  readonly name = 'dev';
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly clockTolerance: number;

  constructor(cfg: AuthConfig, nodeEnv: string) {
    if (nodeEnv === 'production') {
      throw new Error('Dev JWT auth provider cannot be used in production');
    }
    if (!cfg.devSecret || cfg.devSecret.length < 32) {
      throw new Error(
        'AUTH_DEV_SECRET must be set and at least 32 characters for the dev provider',
      );
    }
    if (!cfg.issuer || !cfg.audience) {
      throw new Error(
        'AUTH_ISSUER and AUTH_AUDIENCE are required for the dev provider',
      );
    }
    this.secret = cfg.devSecret;
    this.issuer = cfg.issuer;
    this.audience = cfg.audience;
    this.clockTolerance = cfg.clockToleranceSeconds;
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
        complete: false,
      }) as JwtPayload;

      if (typeof payload.sub !== 'string') {
        throw new TokenVerificationError('invalid', 'missing subject');
      }
      return mapClaimsToUser(payload as Record<string, unknown>, this.name);
    } catch (error) {
      if (error instanceof TokenVerificationError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenVerificationError('expired');
      }
      // All other failures (signature/issuer/audience/format) are generic.
      throw new TokenVerificationError('invalid');
    }
  }
}
