import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { ApiErrorResponse } from '../../common/errors/api-error.response';
import {
  TechnicianLoginRequest,
  TechnicianLoginResponse,
} from './dto/technician-login.dto';
import { TechnicianAuthService } from './technician-auth.service';

/**
 * Technician / Lead Technician login (Phase 3.5). PUBLIC (no bearer required to
 * obtain a token). Verifies credentials against the Sage X3 SQL Server data and
 * issues a token via the existing authentication architecture. The response
 * never contains a password. Sales Representatives are out of scope here.
 */
@ApiTags('Auth')
@Controller('api/auth/technician')
export class TechnicianAuthController {
  constructor(private readonly service: TechnicianAuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Technician / Lead Technician login' })
  @ApiOkResponse({ type: TechnicianLoginResponse })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description: 'Invalid credentials (generic authentication failure)',
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponse,
    description: 'Login data source or token issuer not configured',
  })
  async login(
    @Body() body: TechnicianLoginRequest,
  ): Promise<TechnicianLoginResponse> {
    return this.service.login(body.username, body.password);
  }
}
