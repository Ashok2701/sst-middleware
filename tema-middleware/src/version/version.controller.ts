import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionResponse } from './version.dto';
import { VersionService } from './version.service';

@ApiTags('Version')
@Controller()
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get('version')
  @ApiOperation({ summary: 'Service name and version' })
  @ApiOkResponse({ type: VersionResponse })
  getVersion(): VersionResponse {
    return this.versionService.getVersion();
  }
}
