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
import { CompaniesService } from './companies.service';
import { CompanyDetailResponse, CompanyListResponse } from './dto/company.dto';

/**
 * Read-only Companies (== Crews) API. Requires authentication + the
 * `company.read` permission. Source: FSM.XCREW joined to FSM.XTECHNCN. No CRUD.
 */
@ApiTags('Companies')
@ApiBearerAuth('bearer')
@Controller('api/companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  @Permissions('company.read')
  @ApiOperation({ summary: 'List companies/crews (optionally by site)' })
  @ApiOkResponse({ type: CompanyListResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async list(
    @Query('site') site?: string,
    @Query('limit') limit?: string,
  ): Promise<CompanyListResponse> {
    const parsed = limit ? Number(limit) : undefined;
    const companies = await this.service.list({
      site: site?.trim() || undefined,
      limit: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
    });
    return { companies, count: companies.length };
  }

  @Get(':id')
  @Permissions('company.read')
  @ApiOperation({ summary: 'Get a company/crew with its technicians' })
  @ApiOkResponse({ type: CompanyDetailResponse })
  @ApiUnauthorizedResponse({ type: ApiErrorResponse })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  async getById(@Param('id') id: string): Promise<CompanyDetailResponse> {
    return this.service.getById(id) as unknown as CompanyDetailResponse;
  }
}
