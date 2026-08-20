import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from './auth.types';
import { WhoAmIResponse } from './auth.dto';
import { CurrentUser } from './current-user.decorator';

/**
 * Identity utility endpoint (NOT a business API). Returns the authenticated
 * user established by the global AuthGuard. When authentication is disabled it
 * reports that no identity is established.
 */
@ApiTags('Auth')
@ApiBearerAuth()
@Controller()
export class AuthController {
  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated identity' })
  @ApiOkResponse({ type: WhoAmIResponse })
  me(@CurrentUser() user?: AuthenticatedUser): WhoAmIResponse {
    if (!user) {
      return { authenticated: false, message: 'Authentication is disabled' };
    }
    return { authenticated: true, user };
  }
}
