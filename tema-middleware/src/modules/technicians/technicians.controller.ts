import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/errors/api-error.response';
import { Permissions } from '../../common/authorization/permissions.decorator';
import { TechniciansResponse } from './dto/technician.dto';
import { TechniciansService } from './technicians.service';

/**
 * First TEMA business API. Consumers (e.g. TEMA Scheduling) call this - never
 * SQL Server directly. Requires authentication (AuthGuard) and the
 * `technician.read` permission (AuthorizationGuard).
 *
 * NOTE: 'technician.read' is a PROPOSED permission name; the final naming
 * convention is pending identity-provider/client confirmation and is easy to
 * change in one place here.
 */
@ApiTags('Technicians')
@ApiBearerAuth('bearer')
@Controller('api/technicians')
export class TechniciansController {
  constructor(private readonly service: TechniciansService) {}

  @Get()
  @Permissions('technician.read')
  @ApiOperation({ summary: 'List technicians for scheduling' })
  @ApiOkResponse({ type: TechniciansResponse })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description: 'Not authenticated',
  })
  @ApiForbiddenResponse({
    type: ApiErrorResponse,
    description: 'Missing technician.read',
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponse,
    description: 'Technician data source unavailable/not configured',
  })
  async list(): Promise<TechniciansResponse> {
    const technicians = await this.service.getTechnicians();
    return { technicians, count: technicians.length };
  }
}
