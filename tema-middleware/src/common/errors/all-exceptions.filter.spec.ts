import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(requestId = 'req-1') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = { id: requestId };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any,
    status,
    json,
  };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps a NotFoundException to NOT_FOUND with the requestId', () => {
    const { host, status, json } = mockHost('abc-123');

    filter.catch(new NotFoundException('missing'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'missing',
        requestId: 'abc-123',
      }),
    );
  });

  it('preserves a structured VALIDATION_ERROR payload with details', () => {
    const { host, status, json } = mockHost();

    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'name', constraints: ['name must be a string'] }],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.any(Array),
      }),
    );
  });

  it('hides internal details for unknown errors (500 INTERNAL_ERROR)', () => {
    const { host, status, json } = mockHost('trace-9');

    filter.catch(new Error('secret db connection string leaked'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = json.mock.calls[0][0];
    expect(payload).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: 'trace-9',
    });
    expect(JSON.stringify(payload)).not.toContain('secret db connection');
  });

  it('joins array validation messages from a plain HttpException', () => {
    const { host, json } = mockHost();

    filter.catch(
      new HttpException(
        { message: ['a is required', 'b is invalid'] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'a is required, b is invalid' }),
    );
  });
});
