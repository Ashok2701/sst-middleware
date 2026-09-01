import { ConfigService } from '@nestjs/config';
import {
  SalesRepAuthConfig,
  SqlServerConfig,
} from '../../config/configuration';
import { SalesRepMapper } from './mappers/sales-rep.mapper';
import { SalesRepAuthService } from './sales-rep-auth.service';
import { PlaintextPasswordVerifier } from '../technician-auth/password/password-verifier';

function build(opts: {
  user?: Record<string, unknown>;
  sites?: Record<string, unknown>[];
  sqlEnabled?: boolean;
  issuerAvailable?: boolean;
}) {
  const query = jest.fn((...args: unknown[]) => {
    const text = args[0] as string;
    return Promise.resolve(
      text.includes('XX10CUSERD')
        ? (opts.sites ?? [])
        : opts.user
          ? [opts.user]
          : [],
    );
  });
  const sql = { query } as any;
  const sqlCfg: SqlServerConfig = { enabled: opts.sqlEnabled ?? true } as any;
  const cfg: SalesRepAuthConfig = {
    schema: 'FSM',
    usersTable: 'XX10CUSERS',
    sitesTable: 'XX10CUSERD',
  };
  const config = {
    get: (k: string) =>
      k === 'sqlServer' ? sqlCfg : k === 'salesRepAuth' ? cfg : undefined,
  } as unknown as ConfigService;
  const tracker = { track: (_m: unknown, fn: () => unknown) => fn() } as any;
  const issue = jest.fn(() => ({ token: 'tok', expiresIn: 3600 }));
  const issuer = {
    isAvailable: () => opts.issuerAvailable ?? true,
    issue,
  } as any;
  const service = new SalesRepAuthService(
    sql,
    config,
    tracker,
    new SalesRepMapper(),
    issuer,
    new PlaintextPasswordVerifier(),
  );
  return { service, query, issue };
}

describe('SalesRepAuthService', () => {
  it('logs in an eligible sales rep and returns sites (no password)', async () => {
    const { service, issue } = build({
      user: {
        XAUS_0: 'S1',
        XPWSD_0: 'pw',
        XUSROLE_0: 1,
        XACT_0: 1,
        XAUSNA_0: 'Rep',
      },
      sites: [{ XFCY_0: 'USA01', XDEFFCY_0: 2 }],
    });
    const res = await service.login('S1', 'pw');
    expect(res.user).toMatchObject({
      salesRepId: 'S1',
      role: 'Sales Rep',
      sites: ['USA01'],
    });
    expect(JSON.stringify(res)).not.toContain('"pw"');
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['Sales Rep'],
        permissions: ['salesrep.read'],
      }),
    );
  });

  it('rejects a non-sales-rep role with generic auth failure', async () => {
    const { service } = build({
      user: { XAUS_0: 'S1', XPWSD_0: 'pw', XUSROLE_0: 2, XACT_0: 1 },
    });
    await expect(service.login('S1', 'pw')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('rejects an inactive sales rep', async () => {
    const { service } = build({
      user: { XAUS_0: 'S1', XPWSD_0: 'pw', XUSROLE_0: 1, XACT_0: 2 },
    });
    await expect(service.login('S1', 'pw')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('rejects a wrong password (generic)', async () => {
    const { service } = build({
      user: { XAUS_0: 'S1', XPWSD_0: 'right', XUSROLE_0: 1, XACT_0: 1 },
    });
    await expect(service.login('S1', 'wrong')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('rejects an unknown user (generic)', async () => {
    const { service } = build({});
    await expect(service.login('nobody', 'pw')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('uses parameterized SQL (username bound, never concatenated)', async () => {
    const { service, query } = build({
      user: { XAUS_0: 'S1', XPWSD_0: 'pw', XUSROLE_0: 1, XACT_0: 1 },
      sites: [],
    });
    await service.login('S1', 'pw');
    const [text, params] = query.mock.calls[0];
    expect(text).toContain('WHERE XAUS_0 = @username');
    expect(text).not.toContain("'S1'");
    expect(params).toEqual({ username: 'S1' });
  });

  it('returns safe config error when SQL disabled', async () => {
    const { service } = build({ sqlEnabled: false });
    await expect(service.login('S1', 'pw')).rejects.toMatchObject({
      response: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });
});
