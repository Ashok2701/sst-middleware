import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SqlServerAdapter } from '../src/integrations/sql-server/sql-server.adapter';

const SECRET = 'fsm-secret-fsm-secret-fsm-secret-fsm!!!';
const ISSUER = 'https://tema.test/';
const AUDIENCE = 'tema-middleware';

function sign(perms: string[]): string {
  return jwt.sign({ sub: 'u', permissions: perms }, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: '10m',
  });
}

describe('FSM read APIs - Service Requests & Routes (e2e)', () => {
  let app: INestApplication;
  const query = jest.fn();

  const sqlMock = {
    name: 'sql-server',
    targetSystem: 'SQL Server',
    enabled: true,
    query,
    executeStoredProcedure: jest.fn(),
    checkConnectivity: jest.fn().mockResolvedValue({
      name: 'sql-server',
      targetSystem: 'SQL Server',
      status: 'UP',
      enabled: true,
    }),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const saved = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: 'test',
      AUTH_ENABLED: 'true',
      AUTH_PROVIDER: 'dev',
      AUTH_ISSUER: ISSUER,
      AUTH_AUDIENCE: AUDIENCE,
      AUTH_DEV_SECRET: SECRET,
      RATE_LIMIT_ENABLED: 'false',
      SQL_SERVER_ENABLED: 'true',
      SQL_FSM_SCHEMA: 'FSM',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SqlServerAdapter)
      .useValue(sqlMock)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
    process.env = saved;
  });

  afterAll(async () => await app.close());
  beforeEach(() => query.mockReset());

  const srToken = `Bearer ${sign(['serviceRequest.read'])}`;
  const routeToken = `Bearer ${sign(['route.read'])}`;

  it('lists service requests (requires serviceRequest.read)', async () => {
    query.mockResolvedValue([
      {
        SRENUM_0: 'SRE001',
        SREDES_0: 'Fix',
        XSTATUS_0: 5,
        XDRN_0: 'RT-USA01-0001',
      },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/service-requests?limit=10')
      .set('Authorization', srToken)
      .expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.serviceRequests[0]).toMatchObject({
      serviceRequestNumber: 'SRE001',
      description: 'Fix',
      routeNumber: 'RT-USA01-0001',
    });
  });

  it('returns a service request with nested bases/tasks/jobCards', async () => {
    query
      .mockResolvedValueOnce([{ SRENUM_0: 'SRE001', SREDES_0: 'Fix' }]) // header
      .mockResolvedValueOnce([{ XLINUM_0: 1, XCPNITM_0: 'ITM1' }]) // bases
      .mockResolvedValueOnce([{ HDTNUM_0: 'T1' }]) // tasks
      .mockResolvedValueOnce([{ XJOBCARD_0: 'JC1', XTECH_0: 'TECH9' }]); // jobcards
    const res = await request(app.getHttpServer())
      .get('/api/service-requests/SRE001')
      .set('Authorization', srToken)
      .expect(200);
    expect(res.body).toMatchObject({ serviceRequestNumber: 'SRE001' });
    expect(res.body.bases).toHaveLength(1);
    expect(res.body.tasks[0].taskNumber).toBe('T1');
    expect(res.body.jobCards[0].technicianId).toBe('TECH9');
  });

  it('404s a missing service request', async () => {
    query.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get('/api/service-requests/NOPE')
      .set('Authorization', srToken)
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('forbids service requests without the permission (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/service-requests')
      .set('Authorization', `Bearer ${sign(['other.read'])}`)
      .expect(403);
  });

  it('requires authentication (401)', async () => {
    await request(app.getHttpServer()).get('/api/service-requests').expect(401);
  });

  it('lists routes and returns a route with details (route.read)', async () => {
    query.mockResolvedValueOnce([
      { XDRN_0: 'RT-USA01-0001', XROUTSTATUS_0: 1, XSITE_0: 'USA01' },
    ]);
    const list = await request(app.getHttpServer())
      .get('/api/routes?limit=5')
      .set('Authorization', routeToken)
      .expect(200);
    expect(list.body.routes[0]).toMatchObject({
      xdrn: 'RT-USA01-0001',
      status: 1,
    });

    query
      .mockResolvedValueOnce([{ XDRN_0: 'RT-USA01-0001', XSITE_0: 'USA01' }])
      .mockResolvedValueOnce([
        { XDRN_0: 'RT-USA01-0001', XDRNLIN_0: 1, XBPNAME_0: 'Acme' },
      ]);
    const detail = await request(app.getHttpServer())
      .get('/api/routes/RT-USA01-0001')
      .set('Authorization', routeToken)
      .expect(200);
    expect(detail.body.details).toHaveLength(1);
    expect(detail.body.details[0].customerName).toBe('Acme');
  });

  it('404s a missing route (route.read)', async () => {
    query.mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer())
      .get('/api/routes/RT-NOPE-9999')
      .set('Authorization', routeToken)
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('requires authentication for routes (401)', async () => {
    await request(app.getHttpServer()).get('/api/routes').expect(401);
  });

  it('filters service requests by date and site (bound params)', async () => {
    query.mockResolvedValue([
      { SRENUM_0: 'SRE002', SALFCY_0: 'USA01', SRERESDAT_0: '2026-06-01' },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/service-requests?site=USA01&date=2026-06-01')
      .set('Authorization', srToken)
      .expect(200);
    const [text, params] = query.mock.calls[0];
    expect(text).toContain('SALFCY_0 = @site');
    expect(text).toContain('CAST(SRERESDAT_0 AS DATE) = @date');
    expect(params).toEqual({ site: 'USA01', date: '2026-06-01' });
    expect(res.body.serviceRequests[0]).toMatchObject({
      serviceRequestNumber: 'SRE002',
      site: 'USA01',
    });
  });

  it('rejects a malformed date filter (400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/service-requests?date=01-06-2026')
      .set('Authorization', srToken)
      .expect(404);
    expect(res.body.code).toBe('INVALID_PARAMETER');
  });

  it('lists companies/crews and returns a crew with its technicians (company.read)', async () => {
    const companyToken = `Bearer ${sign(['company.read'])}`;
    query.mockResolvedValueOnce([
      { XCREWID_0: 'CREW1', XCRENAM_0: 'North', XFCY_0: 'USA01', XACTIVE_0: 2 },
    ]);
    const list = await request(app.getHttpServer())
      .get('/api/companies?site=USA01')
      .set('Authorization', companyToken)
      .expect(200);
    expect(list.body.companies[0]).toMatchObject({
      crewId: 'CREW1',
      name: 'North',
      active: true,
    });

    query
      .mockResolvedValueOnce([
        {
          XCREWID_0: 'CREW1',
          XCRENAM_0: 'North',
          XFCY_0: 'USA01',
          XACTIVE_0: 2,
        },
      ])
      .mockResolvedValueOnce([
        { XTECH_0: 'T1', XTECHNAM_0: 'John', XLEADTECH_0: 2 },
      ]);
    const detail = await request(app.getHttpServer())
      .get('/api/companies/CREW1')
      .set('Authorization', companyToken)
      .expect(200);
    expect(detail.body.technicians).toHaveLength(1);
    expect(detail.body.technicians[0]).toMatchObject({
      technicianId: 'T1',
      leadTechnician: true,
    });
  });

  it('404s a missing company and forbids without company.read', async () => {
    query.mockResolvedValueOnce([]);
    const notFound = await request(app.getHttpServer())
      .get('/api/companies/NOPE')
      .set('Authorization', `Bearer ${sign(['company.read'])}`)
      .expect(404);
    expect(notFound.body.code).toBe('NOT_FOUND');

    await request(app.getHttpServer())
      .get('/api/companies')
      .set('Authorization', srToken)
      .expect(403);
    await request(app.getHttpServer()).get('/api/companies').expect(401);
  });
});
