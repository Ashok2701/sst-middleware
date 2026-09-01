import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import {
  PlaintextPasswordVerifier,
  TECHNICIAN_PASSWORD_VERIFIER,
} from '../technician-auth/password/password-verifier';
import { SalesRepMapper } from './mappers/sales-rep.mapper';
import { SalesRepAuthController } from './sales-rep-auth.controller';
import { SalesRepAuthService } from './sales-rep-auth.service';

/**
 * Sales Representative login foundation (Phase 3.6). Reuses the SQL adapter
 * (IntegrationsModule) and the shared LocalTokenIssuer (global AuthModule), and
 * binds the same pluggable PasswordVerifier - same secure mechanism as
 * technician login, separate domain model.
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [SalesRepAuthController],
  providers: [
    SalesRepAuthService,
    SalesRepMapper,
    {
      provide: TECHNICIAN_PASSWORD_VERIFIER,
      useClass: PlaintextPasswordVerifier,
    },
  ],
})
export class SalesRepAuthModule {}
