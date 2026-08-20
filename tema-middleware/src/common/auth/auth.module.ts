import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthenticationService } from './authentication.service';
import { IDENTITY_PROVIDER } from './auth.types';
import { createIdentityProvider } from './identity-provider.factory';

/**
 * Authentication foundation. Provides the configured IdentityProvider, the
 * authentication service and a GLOBAL AuthGuard. The guard is a no-op when
 * AUTH_ENABLED=false, so existing behaviour and startup are unaffected.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: IDENTITY_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createIdentityProvider(
          config.get<AuthConfig>('auth')!,
          config.get<string>('nodeEnv') ?? 'development',
        ),
    },
    AuthenticationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthenticationService, IDENTITY_PROVIDER],
})
export class AuthModule {}
