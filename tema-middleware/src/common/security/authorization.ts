import { AuthenticatedPrincipal } from './authentication';

/**
 * Authorization abstraction for future roles/permissions. Final business roles
 * are not defined yet, so the default policy allows all (auth is not yet
 * enforced). Replace with a real policy when roles are confirmed.
 */
export interface AuthorizationPolicy {
  readonly name: string;
  can(
    principal: AuthenticatedPrincipal | null,
    action: string,
    resource?: string,
  ): boolean;
}

export const AUTHORIZATION_POLICY = Symbol('AUTHORIZATION_POLICY');

export class AllowAllAuthorizationPolicy implements AuthorizationPolicy {
  readonly name = 'allow-all';
  can(): boolean {
    return true;
  }
}
