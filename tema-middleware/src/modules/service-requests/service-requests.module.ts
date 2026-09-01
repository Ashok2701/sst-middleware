import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { ServiceRequestMapper } from './mappers/service-request.mapper';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

/** Read-only Service Request module (Phase 3.6). */
@Module({
  imports: [IntegrationsModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, ServiceRequestMapper],
})
export class ServiceRequestsModule {}
