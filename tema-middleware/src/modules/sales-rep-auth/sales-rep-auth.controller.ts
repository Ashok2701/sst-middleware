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
  SalesRepLoginRequest,
  SalesRepLoginResponse,
} from './dto/sales-rep-login.dto';
import { SalesRepAuthService } from './sales-rep-auth.service';

/**
 * Sales Representative login (Phase 3.6). PUBLIC. Verifies against Sage X3
 * `XX10CUSERS` (role XUSROLE_0=1, active XACT_0=1) and issues a token via the
 * existing auth architecture. Password is never returned. Separate from
 * technician login.
 */
@ApiTags('Auth')
@Controller('api/auth/sales-rep')
export class SalesRepAuthController {
  constructor(private readonly service: SalesRepAuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sales Representative login' })
  @ApiOkResponse({ type: SalesRepLoginResponse })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description: 'Invalid credentials (generic authentication failure)',
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponse,
    description: 'Login data source or token issuer not configured',
  })
  async login(
    @Body() body: SalesRepLoginRequest,
  ): Promise<SalesRepLoginResponse> {
    return this.service.login(body.username, body.password);
  }
}
