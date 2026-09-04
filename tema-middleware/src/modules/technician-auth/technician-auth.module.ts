import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { CompaniesModule } from '../companies/companies.module';
import { TechnicianIdentityMapper } from './mappers/technician-identity.mapper';
import {
  PlaintextPasswordVerifier,
  TECHNICIAN_PASSWORD_VERIFIER,
} from './password/password-verifier';
import { TechnicianAuthController } from './technician-auth.controller';
import { TechnicianAuthService } from './technician-auth.service';

/**
 * Technician login foundation (Phase 3.5). Depends on the SQL Server adapter
 * (via IntegrationsModule) and the global integration core (transaction
 * tracking) + auth config. The password verifier is bound behind a token so it
 * can be swapped for the confirmed WorkSuite PBKDF2-SHA256 verifier later
 * without touching the controller/service/model. The dev token issuer is the
 * shared LocalTokenIssuer provided globally by AuthModule.
 */
@Module({
  imports: [IntegrationsModule, CompaniesModule],
  controllers: [TechnicianAuthController],
  providers: [
    TechnicianAuthService,
    TechnicianIdentityMapper,
    {
      provide: TECHNICIAN_PASSWORD_VERIFIER,
      useClass: PlaintextPasswordVerifier,
    },
  ],
})
export class TechnicianAuthModule {}
