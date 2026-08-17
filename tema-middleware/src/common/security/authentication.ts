/**
 * Authentication abstraction.
 *
 * Standards-based only. The client's identity provider (OAuth2/OIDC/JWT) is not
 * yet confirmed, so the default provider is a no-op. Do NOT build custom
 * username/password auth, password storage or home-grown token generation here.
 */
export interface AuthenticatedPrincipal {
  subject: string;
  roles: string[];
  claims?: Record<string, unknown>;
}

export interface AuthenticationProvider {
  readonly name: string;
  /** Returns a principal, or null when no/invalid credentials are present. */
  authenticate(context: {
    headers: Record<string, unknown>;
  }): Promise<AuthenticatedPrincipal | null>;
}

export const AUTHENTICATION_PROVIDER = Symbol('AUTHENTICATION_PROVIDER');

/** Default: no identity provider configured yet. */
export class NoopAuthenticationProvider implements AuthenticationProvider {
  readonly name = 'noop';
  async authenticate(): Promise<AuthenticatedPrincipal | null> {
    return null;
  }
}
