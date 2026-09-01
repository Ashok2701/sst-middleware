import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permissions } from '../../common/authorization/permissions.decorator';
import { ApiErrorResponse } from '../../common/errors/api-error.response';
import {
  ServiceRequestDetailResponse,
  ServiceRequestListResponse,
} from './dto/service-request.dto';
import { ServiceRequestsService } from './service-requests.service';

/**
 * Read-only Service Request API (Phase 3.6). Requires authentication + the
 * `serviceRequest.read` permission. No CRUD.
 */
@ApiTags('Service Requests')
@ApiBearerAuth('bearer')
@Controller('api/service-requests')
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  @Get()
  @Permissions('serviceRequest.read')
  @ApiOperation({ summary: 'List service requests (summary)' })
  @ApiOkResponse({ type: ServiceRequestListResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async list(
    @Query('limit') limit?: string,
  ): Promise<ServiceRequestListResponse> {
    const parsed = limit ? Number(limit) : undefined;
    const serviceRequests = await this.service.list(
      Number.isFinite(parsed as number) ? (parsed as number) : undefined,
    );
    return { serviceRequests, count: serviceRequests.length };
  }

  @Get(':id')
  @Permissions('serviceRequest.read')
  @ApiOperation({ summary: 'Get a service request with nested detail' })
  @ApiOkResponse({ type: ServiceRequestDetailResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async getById(
    @Param('id') id: string,
  ): Promise<ServiceRequestDetailResponse> {
    return this.service.getById(id) as unknown as ServiceRequestDetailResponse;
  }
}
