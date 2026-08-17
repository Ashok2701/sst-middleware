import { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { createValidationPipe } from './common/validation/validation.pipe';

/**
 * Applies the cross-cutting concerns shared by the running app and the e2e
 * tests. `AppModule` also wires these via DI providers; this helper is used by
 * test harnesses that build a standalone Nest application.
 */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
}
