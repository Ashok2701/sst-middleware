import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from './authorization.types';

/**
 * Requires the authenticated user to hold AT LEAST ONE of the given permissions.
 * Example: `@Permissions('job.read')` or `@Permissions('job.update')`.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
