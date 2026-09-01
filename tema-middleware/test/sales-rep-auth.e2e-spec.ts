import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SqlServerAdapter } from '../src/integrations/sql-server/sql-server.adapter';

describe('POST /api/auth/sales-rep/login (e2e)', () => {
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
      AUTH_ISSUER: 'https://tema.test/',
      AUTH_AUDIENCE: 'tema-middleware',
      AUTH_DEV_SECRET: 'dev-secret-dev-secret-dev-secret-dev!!',
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

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sales-rep/login')
      .send({ username, password });
  }

  it('logs in an eligible sales rep with sites and a usable token', async () => {
    query.mockImplementation((text: string) =>
      Promise.resolve(
        text.includes('XX10CUSERD')
          ? [
              { XFCY_0: 'USA01', XDEFFCY_0: 2 },
              { XFCY_0: 'USA02', XDEFFCY_0: 1 },
            ]
          : [
              {
                XAUS_0: 'S1',
                XPWSD_0: 'pw',
                XUSROLE_0: 1,
                XACT_0: 1,
                XAUSNA_0: 'Rep',
              },
            ],
      ),
    );
    const res = await login('S1', 'pw').expect(200);
    expect(res.body.user).toMatchObject({
      salesRepId: 'S1',
      role: 'Sales Rep',
      sites: ['USA01', 'USA02'],
      defaultSite: 'USA01',
    });
    expect(JSON.stringify(res.body)).not.toContain('pw');

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body.user).toMatchObject({
      roles: ['Sales Rep'],
      permissions: ['salesrep.read'],
    });
  });

  it('rejects a non-sales-rep role with a generic 401', async () => {
    query.mockResolvedValue([
      { XAUS_0: 'S1', XPWSD_0: 'pw', XUSROLE_0: 2, XACT_0: 1 },
    ]);
    const res = await login('S1', 'pw').expect(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects an unknown user with the same generic 401', async () => {
    query.mockResolvedValue([]);
    await login('nobody', 'pw').expect(401);
  });

  it('validates the body (missing password -> 400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sales-rep/login')
      .send({ username: 'S1' })
      .expect(400);
  });
});
