/** Metadata keys for route-level authorization requirements. */
export const ROLES_KEY = 'tema:roles';
export const PERMISSIONS_KEY = 'tema:permissions';

/** Resolved authorization requirement for a route. */
export interface AuthorizationRequirement {
  /** User must have AT LEAST ONE of these roles (OR). Empty/absent = no role check. */
  roles: string[];
  /** User must have AT LEAST ONE of these permissions (OR). Empty/absent = no check. */
  permissions: string[];
}

/** Outcome of an authorization evaluation. */
export interface AuthorizationDecision {
  allowed: boolean;
  /** Which requirement type caused denial (for safe logging). */
  failedOn?: 'role' | 'permission';
}
