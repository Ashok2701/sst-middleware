import { ConfigService } from '@nestjs/config';
import { RoutesConfig } from '../../config/configuration';
import { RouteMapper } from './mappers/route.mapper';
import { RoutesService } from './routes.service';

function build(rows: Record<string, unknown>[][], maxResults = 100) {
  const query = jest.fn();
  rows.forEach((r) => query.mockResolvedValueOnce(r));
  const sql = { query } as any;
  const cfg: RoutesConfig = {
    schema: 'FSM',
    headerTable: 'XX1ROUTPOH',
    detailTable: 'XX1ROUTPOD',
    permission: 'route.read',
    xdrnPrefix: 'RT',
    newStatus: 1,
    sourceStatus: 1524,
    maxResults,
  };
  const config = { get: () => cfg } as unknown as ConfigService;
  const tracker = { track: (_m: unknown, fn: () => unknown) => fn() } as any;
  const service = new RoutesService(sql, config, tracker, new RouteMapper());
  return { service, query };
}

describe('RoutesService', () => {
  it('lists route headers with a capped TOP', async () => {
    const { service, query } = build([
      [{ XDRN_0: 'RT-USA01-0001', XROUTSTATUS_0: 1 }],
    ]);
    const res = await service.list(5);
    expect(res[0]).toMatchObject({ xdrn: 'RT-USA01-0001', status: 1 });
    expect(query.mock.calls[0][0]).toContain('TOP (5)');
  });

  it('caps limit at maxResults', async () => {
    const { service, query } = build([[]], 10);
    await service.list(9999);
    expect(query.mock.calls[0][0]).toContain('TOP (10)');
  });

  it('returns a route header with its detail lines', async () => {
    const { service, query } = build([
      [{ XDRN_0: 'RT-USA01-0001', XSITE_0: 'USA01' }],
      [
        { XDRN_0: 'RT-USA01-0001', XDRNLIN_0: 1, XBPNAME_0: 'Acme' },
        { XDRN_0: 'RT-USA01-0001', XDRNLIN_0: 2 },
      ],
    ]);
    const route = await service.getByXdrn('RT-USA01-0001');
    expect(route.xdrn).toBe('RT-USA01-0001');
    expect(route.details).toHaveLength(2);
    expect(route.details[0]).toMatchObject({
      lineNumber: 1,
      customerName: 'Acme',
    });
    // Parameterized: xdrn bound, not concatenated.
    expect(query.mock.calls[0][1]).toEqual({ xdrn: 'RT-USA01-0001' });
    expect(query.mock.calls[0][0]).not.toContain("'RT-USA01-0001'");
  });

  it('throws NOT_FOUND when the route header is missing', async () => {
    const { service } = build([[]]);
    await expect(service.getByXdrn('RT-X-0001')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('generates an XDRN with the new-route status (no persistence)', () => {
    const { service } = build([]);
    expect(service.generateXdrn('USA01', 1)).toEqual({
      xdrn: 'RT-USA01-0001',
      status: 1,
    });
  });
});
