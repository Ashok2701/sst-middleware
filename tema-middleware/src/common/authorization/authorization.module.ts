import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthorizationGuard } from './authorization.guard';
import { AuthorizationService } from './authorization.service';

/**
 * Authorization / RBAC foundation. Provides the authorization service and a
 * GLOBAL AuthorizationGuard that runs after authentication. Routes opt in via
 * `@Roles(...)` / `@Permissions(...)`; routes without such metadata require
 * only authentication.
 *
 * Imported AFTER AuthModule so the guard sees the AuthenticatedUser.
 */
@Global()
@Module({
  providers: [
    AuthorizationService,
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
