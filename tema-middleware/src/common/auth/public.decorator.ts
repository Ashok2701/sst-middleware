import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'tema:isPublic';

/**
 * Marks a route/controller as public so the global AuthGuard skips it.
 * Used for /health, /ready, /version and /health/integrations.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
