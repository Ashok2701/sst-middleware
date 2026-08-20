import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuditOutcome } from '../audit/audit-event.model';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { getCorrelationId } from '../correlation/correlation.context';
import { authorizationRequired, forbidden } from './authorization.errors';
import { AuthorizationService } from './authorization.service';
import { PERMISSIONS_KEY, ROLES_KEY } from './authorization.types';

/**
 * Global authorization guard. Runs AFTER the authentication guard.
 *
 *   - @Public() routes are skipped.
 *   - Routes with no @Roles/@Permissions metadata: allowed (authN suffices).
 *   - Otherwise an authenticated user is required (else 401), and the user must
 *     satisfy the role/permission rule (else 403).
 *
 * This guard never parses tokens - it consumes the canonical AuthenticatedUser
 * established by the Phase 3.1 AuthGuard.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger('Authorization');

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const roles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [];
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ??
      [];

    if (roles.length === 0 && permissions.length === 0) {
      return true; // authentication alone is sufficient
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;

    if (!user) {
      await this.deny(req, undefined, roles, permissions, 'no-user');
      throw authorizationRequired('Authentication is required');
    }

    const decision = this.authorizationService.authorize(user, {
      roles,
      permissions,
    });
    if (!decision.allowed) {
      await this.deny(req, user, roles, permissions, decision.failedOn);
      throw forbidden();
    }

    return true;
  }

  private async deny(
    req: Request,
    user: AuthenticatedUser | undefined,
    roles: string[],
    permissions: string[],
    failedOn?: string,
  ): Promise<void> {
    const correlationId = getCorrelationId();
    this.logger.warn(
      `authz result=denied failedOn=${failedOn} method=${req.method} ` +
        `path=${req.path} userId=${user?.userId ?? 'anonymous'} ` +
        `requiredRoles=[${roles.join(',')}] ` +
        `requiredPermissions=[${permissions.join(',')}] ` +
        `correlationId=${correlationId}`,
    );
    // Record a business/security audit event (no tokens or full claims).
    await this.audit.record({
      action: 'AUTHORIZATION_DENIED',
      outcome: AuditOutcome.Failure,
      actor: user?.userId,
      metadata: {
        method: req.method,
        path: req.path,
        failedOn,
        requiredRoles: roles,
        requiredPermissions: permissions,
      },
    });
  }
}
