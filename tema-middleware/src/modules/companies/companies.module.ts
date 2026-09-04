import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyMapper } from './mappers/company.mapper';

/**
 * Read-only Companies (== Crews) module. Exports CompaniesService so the
 * technician login can enrich its response with the technician's crew/company.
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyMapper],
  exports: [CompaniesService],
})
export class CompaniesModule {}
