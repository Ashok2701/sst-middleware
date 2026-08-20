import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

/**
 * Authorization error codes, consistent with the existing TEMA error model.
 * Rendered by the global exception filter as `{ code, message, requestId }`
 * with no token contents, claims, secrets, stack traces or internal details.
 *
 * HTTP semantics: 401 = unauthenticated, 403 = authenticated but not authorized.
 */
export enum AuthorizationErrorCode {
  AuthorizationRequired = 'AUTHORIZATION_REQUIRED',
  Forbidden = 'FORBIDDEN',
}

export function authorizationRequired(
  message = 'Authentication is required',
): UnauthorizedException {
  return new UnauthorizedException({
    code: AuthorizationErrorCode.AuthorizationRequired,
    message,
  });
}

export function forbidden(
  message = 'You do not have permission to perform this action',
): ForbiddenException {
  return new ForbiddenException({
    code: AuthorizationErrorCode.Forbidden,
    message,
  });
}
