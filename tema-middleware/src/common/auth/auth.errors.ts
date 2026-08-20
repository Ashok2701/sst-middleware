import { UnauthorizedException } from '@nestjs/common';

/**
 * Authentication error codes, consistent with the existing TEMA error model.
 * The global exception filter renders these as `{ code, message, requestId }`
 * with no token contents, secrets, stack traces or internal details.
 */
export enum AuthErrorCode {
  AuthenticationRequired = 'AUTHENTICATION_REQUIRED',
  AuthenticationFailed = 'AUTHENTICATION_FAILED',
  TokenExpired = 'TOKEN_EXPIRED',
}

export function authenticationRequired(
  message = 'Authentication is required',
): UnauthorizedException {
  return new UnauthorizedException({
    code: AuthErrorCode.AuthenticationRequired,
    message,
  });
}

export function authenticationFailed(
  message = 'Authentication failed',
): UnauthorizedException {
  return new UnauthorizedException({
    code: AuthErrorCode.AuthenticationFailed,
    message,
  });
}

export function tokenExpired(
  message = 'The access token has expired',
): UnauthorizedException {
  return new UnauthorizedException({
    code: AuthErrorCode.TokenExpired,
    message,
  });
}
