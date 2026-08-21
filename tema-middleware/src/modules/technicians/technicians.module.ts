import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { TechnicianMapper } from './mappers/technician.mapper';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

/**
 * Technicians business module. Depends on the integration layer (SQL Server
 * adapter via IntegrationsModule) and the global integration core (transaction
 * tracking) - not on any direct database access.
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [TechniciansController],
  providers: [TechniciansService, TechnicianMapper],
})
export class TechniciansModule {}
