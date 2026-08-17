import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation.constants';

/**
 * Ensures every incoming request carries a correlation id.
 *
 * - If the caller supplies `x-correlation-id`, that value is reused (propagation).
 * - Otherwise a new UUID is generated.
 * - The resolved id is attached to the request (`req.correlationId`) and echoed
 *   back on the response so callers can trace the request end-to-end.
 *
 * The operation is idempotent, so it is safe regardless of middleware ordering.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerValue = req.headers[CORRELATION_ID_HEADER];
    const fromHeader = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    const correlationId =
      (req as any).correlationId || fromHeader || randomUUID();

    (req as any).correlationId = correlationId;

    if (!res.getHeader(CORRELATION_ID_HEADER)) {
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    next();
  }
}
