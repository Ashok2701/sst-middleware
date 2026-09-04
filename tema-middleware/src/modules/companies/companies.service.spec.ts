import { ConfigService } from '@nestjs/config';
import { CompaniesConfig } from '../../config/configuration';
import { CompaniesService } from './companies.service';
import { CompanyMapper } from './mappers/company.mapper';

function build(rowsByCall: unknown[][]) {
  const query = jest.fn();
  rowsByCall.forEach((r) => query.mockResolvedValueOnce(r));
  const sql = { query } as any;
  const cfg: CompaniesConfig = {
    schema: 'FSM',
    crewTable: 'XCREW',
    technicianTable: 'XTECHNCN',
    permission: 'company.read',
    maxResults: 100,
  };
  const config = {
    get: (k: string) => (k === 'companies' ? cfg : undefined),
  } as unknown as ConfigService;
  const tracker = { track: (_m: unknown, fn: () => unknown) => fn() } as any;
  const service = new CompaniesService(
    sql,
    config,
    tracker,
    new CompanyMapper(),
  );
  return { service, query };
}

describe('CompaniesService', () => {
  it('lists crews and never selects the crew password', async () => {
    const { service, query } = build([
      [{ XCREWID_0: 'C1', XCRENAM_0: 'North', XFCY_0: 'USA01', XACTIVE_0: 2 }],
    ]);
    const res = await service.list();
    expect(res[0]).toEqual({
      crewId: 'C1',
      name: 'North',
      site: 'USA01',
      active: true,
    });
    const [text] = query.mock.calls[0];
    expect(text).not.toContain('XPASSWRD');
    expect(text).toContain('[FSM].[XCREW]');
  });

  it('filters the list by site (bound parameter)', async () => {
    const { service, query } = build([[]]);
    await service.list({ site: 'USA01' });
    const [text, params] = query.mock.calls[0];
    expect(text).toContain('WHERE XFCY_0 = @site');
    expect(params).toEqual({ site: 'USA01' });
  });

  it('returns crew detail with its technicians (no password col)', async () => {
    const { service, query } = build([
      [{ XCREWID_0: 'C1', XCRENAM_0: 'North', XFCY_0: 'USA01', XACTIVE_0: 2 }],
      [
        {
          XTECH_0: 'T1',
          XTECHNAM_0: 'John',
          XLEADTECH_0: 2,
          XSKLTYP_0: 'HVAC',
        },
      ],
    ]);
    const res = await service.getById('C1');
    expect(res.crewId).toBe('C1');
    expect(res.technicians).toHaveLength(1);
    expect(res.technicians[0]).toMatchObject({
      technicianId: 'T1',
      name: 'John',
      leadTechnician: true,
      skillType: 'HVAC',
    });
    const techQueryText = query.mock.calls[1][0];
    expect(techQueryText).toContain('WHERE XCREWID_0 = @id');
    expect(techQueryText).not.toContain('XPASSWRD');
    expect(query.mock.calls[1][1]).toEqual({ id: 'C1' });
  });

  it('404s a missing crew', async () => {
    const { service } = build([[]]);
    await expect(service.getById('NOPE')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('getSummary returns undefined when the crew is absent', async () => {
    const { service } = build([[]]);
    expect(await service.getSummary('X')).toBeUndefined();
  });
});
