import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { authenticationRequired } from './auth.errors';
import { AuthenticationService } from './authentication.service';
import { IS_PUBLIC_KEY } from './public.decorator';

const BEARER_RE = /^Bearer\s+(\S+)$/i;

/**
 * Global authentication guard.
 *
 * - Skips when auth is disabled (AUTH_ENABLED=false) or the route is @Public.
 * - Otherwise requires `Authorization: Bearer <token>`, verifies it via the
 *   configured provider and attaches the authenticated user to the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly authService: AuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.get<boolean>('auth.enabled')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? BEARER_RE.exec(header) : null;
    if (!match) {
      throw authenticationRequired('A bearer token is required');
    }

    req.user = await this.authService.authenticate(match[1], req.path);
    return true;
  }
}
