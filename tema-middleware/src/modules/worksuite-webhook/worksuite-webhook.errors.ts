import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Safe, consumer-facing webhook errors. Rendered by the global exception filter
 * as `{ code, message, requestId }` - never leaking secrets, signatures or
 * internal WorkSuite error detail.
 */
export enum WorksuiteWebhookErrorCode {
  Rejected = 'WEBHOOK_REJECTED',
  Disabled = 'WEBHOOK_DISABLED',
  NotConfigured = 'WEBHOOK_NOT_CONFIGURED',
  InvalidPayload = 'WEBHOOK_INVALID_PAYLOAD',
}

export function webhookRejected(): UnauthorizedException {
  return new UnauthorizedException({
    code: WorksuiteWebhookErrorCode.Rejected,
    message: 'Webhook verification failed',
  });
}

export function webhookDisabled(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: WorksuiteWebhookErrorCode.Disabled,
    message: 'WorkSuite webhook processing is disabled',
  });
}

export function webhookNotConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: WorksuiteWebhookErrorCode.NotConfigured,
    message: 'WorkSuite webhook is not configured',
  });
}

export function webhookInvalidPayload(): BadRequestException {
  return new BadRequestException({
    code: WorksuiteWebhookErrorCode.InvalidPayload,
    message: 'Webhook payload could not be processed',
  });
}
