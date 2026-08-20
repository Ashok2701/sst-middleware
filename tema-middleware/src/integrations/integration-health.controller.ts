import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator';
import { IntegrationHealthResponse } from './integration-health.dto';
import { IntegrationRegistry } from './integration-registry.service';

/**
 * Internal integration connectivity view. This does NOT affect the Phase 1.5
 * `/health` and `/ready` semantics - it is a separate, read-only capability.
 * Never exposes credentials or connection strings.
 */
@ApiTags('Health')
@Public()
@Controller('health')
export class IntegrationHealthController {
  constructor(private readonly registry: IntegrationRegistry) {}

  @Get('integrations')
  @ApiOperation({
    summary:
      'Connectivity status of configured integrations (UP/DOWN/DISABLED)',
  })
  @ApiOkResponse({ type: IntegrationHealthResponse })
  async integrations(): Promise<IntegrationHealthResponse> {
    return { integrations: await this.registry.checkAll() };
  }
}
