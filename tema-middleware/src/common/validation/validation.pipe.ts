import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

/** Flattens class-validator errors into a compact, safe structure. */
function flattenErrors(errors: ValidationError[], parent = ''): unknown[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current = error.constraints
      ? [{ field, constraints: Object.values(error.constraints) }]
      : [];
    const children = error.children?.length
      ? flattenErrors(error.children, field)
      : [];
    return [...current, ...children];
  });
}

/**
 * Global validation pipe factory.
 *
 * This is the foundation future DTOs build on: any DTO decorated with
 * class-validator decorators is automatically validated. Invalid payloads
 * are rejected with a consistent `VALIDATION_ERROR` response (formatted by
 * the global exception filter).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: flattenErrors(errors),
      }),
  });
}
