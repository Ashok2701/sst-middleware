import { ConfigService } from '@nestjs/config';
import {
  SqlServerConfig,
  TechnicianAuthConfig,
} from '../../config/configuration';
import { TechnicianIdentityMapper } from './mappers/technician-identity.mapper';
import { PlaintextPasswordVerifier } from './password/password-verifier';
import { TechnicianAuthService } from './technician-auth.service';
import { TechnicianRole } from './models/technician-identity.model';

const okIssuer = {
  isAvailable: () => true,
  issue: jest.fn(() => ({ token: 'signed.jwt.token', expiresIn: 3600 })),
};

function build(opts: {
  rows?: unknown[];
  sqlEnabled?: boolean;
  issuerAvailable?: boolean;
  ta?: Partial<TechnicianAuthConfig>;
  queryImpl?: jest.Mock;
}) {
  const query = opts.queryImpl ?? jest.fn().mockResolvedValue(opts.rows ?? []);
  const executeStoredProcedure = jest.fn().mockResolvedValue(opts.rows ?? []);
  const sql = { query, executeStoredProcedure } as any;

  const sqlCfg: SqlServerConfig = { enabled: opts.sqlEnabled ?? true } as any;
  const ta: TechnicianAuthConfig = {
    schema: 'FSM',
    table: 'XTECHNCN',
    usernameColumn: 'XTECHNCN_0',
    ...opts.ta,
  };
  const config = {
    get: (k: string) =>
      k === 'sqlServer' ? sqlCfg : k === 'technicianAuth' ? ta : undefined,
  } as unknown as ConfigService;

  const tracker = { track: (_m: unknown, fn: () => unknown) => fn() } as any;
  const issuer = {
    isAvailable: () => opts.issuerAvailable ?? true,
    issue: okIssuer.issue,
  } as any;

  const service = new TechnicianAuthService(
    sql,
    config,
    tracker,
    new TechnicianIdentityMapper(),
    issuer,
    new PlaintextPasswordVerifier(),
  );
  return { service, query, executeStoredProcedure, issuer };
}

describe('TechnicianAuthService', () => {
  beforeEach(() => okIssuer.issue.mockClear());

  it('logs in a Technician with valid credentials (never returns password)', async () => {
    const { service } = build({
      rows: [
        { XTECH_0: 'T1', XTECHNCN_0: 'jdoe', XPASSWRD_0: 'pw', XLEADTECH_0: 1 },
      ],
    });
    const res = await service.login('jdoe', 'pw');
    expect(res.user).toEqual({
      technicianId: 'T1',
      username: 'jdoe',
      role: TechnicianRole.Technician,
    });
    expect(res.tokenType).toBe('Bearer');
    expect(res.accessToken).toBe('signed.jwt.token');
    expect(JSON.stringify(res)).not.toContain('"pw"');
    expect(JSON.stringify(res)).not.toContain('XPASSWRD');
  });

  it('logs in a Lead Technician when XLEADTECH_0 = 2', async () => {
    const { service, issuer } = build({
      rows: [
        { XTECH_0: 'T2', XTECHNCN_0: 'lead', XPASSWRD_0: 'pw', XLEADTECH_0: 2 },
      ],
    });
    const res = await service.login('lead', 'pw');
    expect(res.user.role).toBe(TechnicianRole.LeadTechnician);
    expect(issuer.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'T2',
        roles: ['Lead Technician'],
        permissions: ['technician.read'],
      }),
    );
  });

  it('uses a parameterized query (username bound, never concatenated)', async () => {
    const { service, query } = build({
      rows: [
        { XTECH_0: 'T1', XTECHNCN_0: 'jdoe', XPASSWRD_0: 'pw', XLEADTECH_0: 1 },
      ],
    });
    await service.login('jdoe', 'pw');
    const [text, params] = query.mock.calls[0];
    expect(text).toContain('WHERE [XTECHNCN_0] = @username');
    expect(text).toContain('[FSM].[XTECHNCN]');
    expect(text).toContain('AS XTECHNCN_0');
    expect(text).not.toContain('jdoe');
    expect(params).toEqual({ username: 'jdoe' });
  });

  it('rejects an unknown username with a generic AUTHENTICATION_FAILED', async () => {
    const { service } = build({ rows: [] });
    await expect(service.login('nobody', 'pw')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('rejects a wrong password with the SAME generic error (no oracle)', async () => {
    const { service } = build({
      rows: [
        {
          XTECH_0: 'T1',
          XTECHNCN_0: 'jdoe',
          XPASSWRD_0: 'right',
          XLEADTECH_0: 1,
        },
      ],
    });
    await expect(service.login('jdoe', 'wrong')).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_FAILED' },
    });
  });

  it('returns a safe config error when SQL is disabled', async () => {
    const { service } = build({ rows: [], sqlEnabled: false });
    await expect(service.login('jdoe', 'pw')).rejects.toMatchObject({
      response: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('returns a safe config error when the token issuer is unavailable', async () => {
    const { service } = build({ rows: [], issuerAvailable: false });
    await expect(service.login('jdoe', 'pw')).rejects.toMatchObject({
      response: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('maps a SQL failure to a safe error (no SQL/secret leak)', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('ETIMEOUT boom'), { code: 'TIMEOUT_ERROR' }),
      );
    const { service } = build({ queryImpl: query });
    const err = await service.login('jdoe', 'pw').catch((e) => e);
    expect(JSON.stringify(err)).not.toContain('SELECT');
    expect(JSON.stringify(err)).not.toContain('XPASSWRD');
  });

  it('uses the stored procedure when configured', async () => {
    const { service, executeStoredProcedure, query } = build({
      rows: [
        { XTECH_0: 'T1', XTECHNCN_0: 'jdoe', XPASSWRD_0: 'pw', XLEADTECH_0: 1 },
      ],
      ta: { loginProcedure: 'FSM.usp_TechnicianLogin' },
    });
    await service.login('jdoe', 'pw');
    expect(executeStoredProcedure).toHaveBeenCalledWith(
      'FSM.usp_TechnicianLogin',
      {
        username: 'jdoe',
      },
    );
    expect(query).not.toHaveBeenCalled();
  });
});
