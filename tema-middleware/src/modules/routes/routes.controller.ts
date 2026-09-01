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
import { RouteDetailResponse, RouteListResponse } from './dto/route.dto';
import { RoutesService } from './routes.service';

/**
 * Read-only route API (Phase 3.6). Requires authentication + `route.read`.
 * Returns a route header with its detail lines. No route creation/persistence.
 */
@ApiTags('Routes')
@ApiBearerAuth('bearer')
@Controller('api/routes')
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get()
  @Permissions('route.read')
  @ApiOperation({ summary: 'List route headers' })
  @ApiOkResponse({ type: RouteListResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async list(
    @Query('limit') limit?: string,
    @Query('site') site?: string,
  ): Promise<RouteListResponse> {
    const parsed = limit ? Number(limit) : undefined;
    const routes = await this.service.list(
      Number.isFinite(parsed as number) ? (parsed as number) : undefined,
      site,
    );
    return { routes, count: routes.length };
  }

  @Get(':xdrn')
  @Permissions('route.read')
  @ApiOperation({ summary: 'Get a route header with its detail lines' })
  @ApiOkResponse({ type: RouteDetailResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async getByXdrn(@Param('xdrn') xdrn: string): Promise<RouteDetailResponse> {
    return this.service.getByXdrn(xdrn) as unknown as RouteDetailResponse;
  }
}
