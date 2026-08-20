/**
 * Canonical authenticated-user identity used across TEMA.
 *
 * Contains ONLY fields TEMA needs. Fields that are not guaranteed by the
 * eventual identity provider are optional and default to empty - no claims
 * are invented.
 */
export interface AuthenticatedUser {
  /** Stable subject id from the token (`sub`). */
  userId: string;
  username?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  /** Which provider established this identity ('dev' | 'oidc' | ...). */
  identityProvider: string;
}

/**
 * Provider-agnostic identity provider contract. Implementations validate an
 * inbound bearer token and return the canonical user. TEMA depends on THIS
 * abstraction, never on a specific provider (WorkSuite/OIDC plug in later).
 */
export interface IdentityProvider {
  readonly name: string;
  verify(token: string): Promise<AuthenticatedUser>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

/** Raised by providers on verification failure. Never carries token contents. */
export class TokenVerificationError extends Error {
  constructor(
    readonly kind: 'expired' | 'invalid',
    message = 'token verification failed',
  ) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}
