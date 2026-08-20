import { AuthenticatedUser } from './auth.types';

/**
 * Maps raw JWT claims to the canonical AuthenticatedUser. Only maps claims that
 * are present; roles/permissions default to empty arrays. No claims invented.
 */
export function mapClaimsToUser(
  claims: Record<string, unknown>,
  identityProvider: string,
): AuthenticatedUser {
  const roles = Array.isArray(claims.roles)
    ? (claims.roles as unknown[]).map(String)
    : [];

  let permissions: string[] = [];
  if (Array.isArray(claims.permissions)) {
    permissions = (claims.permissions as unknown[]).map(String);
  } else if (typeof claims.scope === 'string') {
    permissions = claims.scope.split(' ').filter(Boolean);
  }

  return {
    userId: String(claims.sub),
    username:
      (claims.preferred_username as string) ??
      (claims.username as string) ??
      undefined,
    email: (claims.email as string) ?? undefined,
    roles,
    permissions,
    identityProvider,
  };
}
