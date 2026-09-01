import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { RouteMapper } from './mappers/route.mapper';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

/** Read-only route module + XDRN generator (Phase 3.6). */
@Module({
  imports: [IntegrationsModule],
  controllers: [RoutesController],
  providers: [RoutesService, RouteMapper],
})
export class RoutesModule {}
