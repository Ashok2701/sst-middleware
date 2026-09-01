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

  it('forbids routes without route.read (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/routes')
      .set('Authorization', srToken)
      .expect(403);
  });
});
