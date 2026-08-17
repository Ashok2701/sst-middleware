import { Global, Module } from '@nestjs/common';
import {
  AUTHENTICATION_PROVIDER,
  NoopAuthenticationProvider,
} from './authentication';
import {
  AllowAllAuthorizationPolicy,
  AUTHORIZATION_POLICY,
} from './authorization';

/**
 * Security foundation. Provides pluggable authentication/authorization
 * abstractions with safe no-op defaults. These are NOT yet enforced as guards -
 * enforcement is wired once the client's identity provider and roles are known.
 */
@Global()
@Module({
  providers: [
    { provide: AUTHENTICATION_PROVIDER, useClass: NoopAuthenticationProvider },
    { provide: AUTHORIZATION_POLICY, useClass: AllowAllAuthorizationPolicy },
  ],
  exports: [AUTHENTICATION_PROVIDER, AUTHORIZATION_POLICY],
})
export class SecurityModule {}
