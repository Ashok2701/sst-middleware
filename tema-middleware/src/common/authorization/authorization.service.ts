import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  AuthorizationDecision,
  AuthorizationRequirement,
} from './authorization.types';

/**
 * Evaluates whether an authenticated user satisfies a route's authorization
 * requirement.
 *
 * Deterministic rule (documented):
 *   - Within @Roles(...):       user needs AT LEAST ONE listed role       (OR).
 *   - Within @Permissions(...): user needs AT LEAST ONE listed permission (OR).
 *   - When BOTH are present:    BOTH checks must pass                     (AND).
 *   - No requirement:           allowed (authentication alone suffices).
 *
 * Fails closed: unknown/empty roles or permissions never grant access.
 */
@Injectable()
export class AuthorizationService {
  authorize(
    user: AuthenticatedUser,
    requirement: AuthorizationRequirement,
  ): AuthorizationDecision {
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const userPermissions = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    if (requirement.roles.length > 0) {
      const ok = requirement.roles.some((r) => userRoles.includes(r));
      if (!ok) return { allowed: false, failedOn: 'role' };
    }

    if (requirement.permissions.length > 0) {
      const ok = requirement.permissions.some((p) =>
        userPermissions.includes(p),
      );
      if (!ok) return { allowed: false, failedOn: 'permission' };
    }

    return { allowed: true };
  }
}
