import { CorrelationMiddleware } from './correlation.middleware';
import { CORRELATION_ID_HEADER } from './correlation.constants';

function mockRes() {
  const headers: Record<string, any> = {};
  return {
    headers,
    getHeader: (k: string) => headers[k],
    setHeader: (k: string, v: any) => {
      headers[k] = v;
    },
  } as any;
}

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
  });

  it('generates a correlation id when none is provided', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(typeof req.correlationId).toBe('string');
    expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(req.correlationId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses a caller-provided correlation id (propagation)', () => {
    const provided = 'caller-supplied-id-123';
    const req: any = { headers: { [CORRELATION_ID_HEADER]: provided } };
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe(provided);
    expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(provided);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
