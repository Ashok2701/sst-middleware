import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getCorrelationId } from '../correlation/correlation.context';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../integration/errors/integration-error';
import { httpStatusToErrorCode } from './error-codes';

/** Maps an internal integration error code to an outward HTTP status. */
function integrationCodeToHttpStatus(code: IntegrationErrorCode): number {
  switch (code) {
    case IntegrationErrorCode.VALIDATION_ERROR:
    case IntegrationErrorCode.REMOTE_VALIDATION_ERROR:
      return HttpStatus.BAD_REQUEST;
    case IntegrationErrorCode.AUTHENTICATION_ERROR:
      return HttpStatus.UNAUTHORIZED;
    case IntegrationErrorCode.AUTHORIZATION_ERROR:
      return HttpStatus.FORBIDDEN;
    case IntegrationErrorCode.DUPLICATE_OPERATION:
      return HttpStatus.CONFLICT;
    case IntegrationErrorCode.RATE_LIMIT_ERROR:
      return HttpStatus.TOO_MANY_REQUESTS;
    case IntegrationErrorCode.TIMEOUT_ERROR:
      return HttpStatus.GATEWAY_TIMEOUT;
    case IntegrationErrorCode.CONNECTION_ERROR:
    case IntegrationErrorCode.REMOTE_SYSTEM_ERROR:
      return HttpStatus.BAD_GATEWAY;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Catches every unhandled exception and converts it into a consistent
 * error payload: `{ code, message, requestId, details? }`.
 *
 * Stack traces, raw backend errors and internal implementation details are
 * logged server-side but NEVER returned to API consumers.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = String(
      (request as any)?.id ??
        (request as any)?.correlationId ??
        getCorrelationId() ??
        '',
    );

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof IntegrationError) {
      // Normalised integration failure - expose only the safe public shape.
      status = integrationCodeToHttpStatus(exception.code);
      const publicBody = exception.toPublic(requestId);
      code = publicBody.code;
      message = publicBody.message;
      this.logger.error(
        `IntegrationError code=${exception.code} ` +
          `target=${exception.targetSystem ?? 'n/a'} ` +
          `operation=${exception.operation ?? 'n/a'} ` +
          `requestId=${requestId}`,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        code = httpStatusToErrorCode(status);
        message = raw;
      } else if (raw && typeof raw === 'object') {
        const body = raw as Record<string, any>;
        code = body.code ?? httpStatusToErrorCode(status);
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? exception.message);
        details = body.details;
      }
    } else {
      // Unknown / unexpected error: log full detail, expose nothing.
      this.logger.error(
        `Unhandled exception [requestId=${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR &&
      exception instanceof HttpException
    ) {
      this.logger.error(`HTTP ${status} [requestId=${requestId}]: ${message}`);
    }

    const payload: Record<string, unknown> = { code, message, requestId };
    if (details !== undefined) {
      payload.details = details;
    }

    response.status(status).json(payload);
  }
}
