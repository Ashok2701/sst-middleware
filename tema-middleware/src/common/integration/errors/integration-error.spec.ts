import { IntegrationError, IntegrationErrorCode } from './integration-error';

describe('IntegrationError', () => {
  it('exposes only a safe public shape (no internal details)', () => {
    const err = new IntegrationError(IntegrationErrorCode.REMOTE_SYSTEM_ERROR, {
      targetSystem: 'Sage X3',
      operation: 'checkConnectivity',
      cause: new Error('ECONNREFUSED 10.0.0.5:443 secret-host'),
      internalDetails: { host: 'secret-host', password: 'p@ss' },
    });

    const pub = err.toPublic('REQ-1');
    expect(pub).toEqual({
      code: 'REMOTE_SYSTEM_ERROR',
      message: 'The downstream system could not complete the request',
      requestId: 'REQ-1',
    });
    expect(JSON.stringify(pub)).not.toContain('secret-host');
    expect(JSON.stringify(pub)).not.toContain('p@ss');
  });

  it('derives sensible default retryability from the code', () => {
    expect(
      new IntegrationError(IntegrationErrorCode.TIMEOUT_ERROR).retryable,
    ).toBe(true);
    expect(
      new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR).retryable,
    ).toBe(true);
    expect(
      new IntegrationError(IntegrationErrorCode.REMOTE_VALIDATION_ERROR)
        .retryable,
    ).toBe(false);
    expect(
      new IntegrationError(IntegrationErrorCode.DUPLICATE_OPERATION).retryable,
    ).toBe(false);
  });

  it('honours an explicit retryable override', () => {
    expect(
      new IntegrationError(IntegrationErrorCode.REMOTE_SYSTEM_ERROR, {
        retryable: false,
      }).retryable,
    ).toBe(false);
  });
});
