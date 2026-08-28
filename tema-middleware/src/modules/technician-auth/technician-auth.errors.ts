import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Safe, consumer-facing technician-login errors. Reuses the existing
 * INTEGRATION_NOT_CONFIGURED code (no new error types). Rendered by the global
 * filter as `{ code, message, requestId }` - never leaking SQL, credentials or
 * internal detail.
 */
export function loginNotAvailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'INTEGRATION_NOT_CONFIGURED',
    message:
      'Technician login is not available for the current authentication provider',
  });
}

export function loginSourceNotConfigured(
  message = 'Technician login data source is not configured',
): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'INTEGRATION_NOT_CONFIGURED',
    message,
  });
}
