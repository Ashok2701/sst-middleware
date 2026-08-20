import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from 'jsonwebtoken';
import { AuthConfig } from '../../config/configuration';
import {
  AuthenticatedUser,
  IdentityProvider,
  TokenVerificationError,
} from './auth.types';
import { mapClaimsToUser } from './claims.mapper';

/**
 * Production-grade OIDC/JWKS identity provider (RS256).
 *
 * Fetches issuer-controlled public keys from an HTTPS JWKS endpoint and
 * validates signature, algorithm, kid, issuer, audience and expiry. Ready to be
 * pointed at the client's confirmed identity provider (incl. a future WorkSuite
 * OIDC endpoint) purely via configuration - no code changes required.
 */
export class OidcJwksProvider implements IdentityProvider {
  readonly name = 'oidc';
  private readonly issuer: string;
  private readonly audience: string;
  private readonly clockTolerance: number;
  private readonly client: {
    getSigningKey(kid: string): Promise<{ getPublicKey(): string }>;
  };

  constructor(cfg: AuthConfig) {
    if (!cfg.issuer || !cfg.audience) {
      throw new Error(
        'AUTH_ISSUER and AUTH_AUDIENCE are required for the oidc provider',
      );
    }
    if (!cfg.jwksUri || !cfg.jwksUri.startsWith('https://')) {
      throw new Error(
        'AUTH_JWKS_URI must be set and use HTTPS for the oidc provider',
      );
    }
    this.issuer = cfg.issuer;
    this.audience = cfg.audience;
    this.clockTolerance = cfg.clockToleranceSeconds;
    // Lazy require: jwks-rsa pulls in ESM-only `jose`, which must not be loaded
    // unless the OIDC provider is actually selected.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwksClient = require('jwks-rsa');
    this.client = jwksClient({
      jwksUri: cfg.jwksUri,
      timeout: 5000,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await new Promise<JwtPayload>((resolve, reject) => {
        const getKey = (header: JwtHeader, cb: SigningKeyCallback) => {
          if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
            return cb(new Error('invalid signing header'));
          }
          this.client
            .getSigningKey(header.kid)
            .then((key) => cb(null, key.getPublicKey()))
            .catch(() => cb(new Error('signing key unavailable')));
        };
        jwt.verify(
          token,
          getKey,
          {
            algorithms: ['RS256'],
            issuer: this.issuer,
            audience: this.audience,
            clockTolerance: this.clockTolerance,
            complete: false,
          },
          (err, decoded) => {
            if (err) return reject(err);
            if (!decoded || typeof decoded === 'string') {
              return reject(new Error('invalid token'));
            }
            resolve(decoded);
          },
        );
      });

      if (typeof payload.sub !== 'string') {
        throw new TokenVerificationError('invalid', 'missing subject');
      }
      return mapClaimsToUser(payload as Record<string, unknown>, this.name);
    } catch (error) {
      if (error instanceof TokenVerificationError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenVerificationError('expired');
      }
      throw new TokenVerificationError('invalid');
    }
  }
}
