import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './authorization.types';

/**
 * Requires the authenticated user to hold AT LEAST ONE of the given roles.
 * Example: `@Roles('TECHNICIAN', 'LEAD_TECHNICIAN')`.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
