import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponse, ReadinessResponse } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe - is the service running?' })
  @ApiOkResponse({ type: HealthResponse })
  liveness(): HealthResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe - is the service ready to receive traffic?',
  })
  @ApiOkResponse({ type: ReadinessResponse })
  readiness(): ReadinessResponse {
    return this.healthService.getReadiness();
  }
}
