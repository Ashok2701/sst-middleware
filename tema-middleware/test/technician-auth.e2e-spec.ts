import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SqlServerAdapter } from '../src/integrations/sql-server/sql-server.adapter';

describe('POST /api/auth/technician/login (e2e)', () => {
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
      AUTH_TOKEN_TTL: '3600',
      RATE_LIMIT_ENABLED: 'false',
      SQL_SERVER_ENABLED: 'true',
      SQL_TECHNICIAN_SCHEMA: 'FSM',
      SQL_TECHNICIAN_TABLE: 'XTECHNCN',
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
      .post('/api/auth/technician/login')
      .send({ username, password });
  }

  it('logs in a Technician and returns a usable Bearer token (no password)', async () => {
    query.mockResolvedValue([
      {
        XTECH_0: 'T1',
        XTECHNCN_0: 'jdoe',
        XPASSWRD_0: 'pw123',
        XLEADTECH_0: 1,
      },
    ]);
    const res = await login('jdoe', 'pw123').expect(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      user: { technicianId: 'T1', username: 'jdoe', role: 'Technician' },
    });
    expect(res.body.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('pw123');
    expect(JSON.stringify(res.body)).not.toContain('XPASSWRD');

    // The minted token is accepted by the existing AuthGuard on /me.
    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body.user).toMatchObject({
      userId: 'T1',
      username: 'jdoe',
      roles: ['Technician'],
      permissions: ['technician.read'],
    });
  });

  it('maps XLEADTECH_0 = 2 to Lead Technician', async () => {
    query.mockResolvedValue([
      { XTECH_0: 'T2', XTECHNCN_0: 'lead', XPASSWRD_0: 'pw', XLEADTECH_0: 2 },
    ]);
    const res = await login('lead', 'pw').expect(200);
    expect(res.body.user.role).toBe('Lead Technician');
  });

  it('non-2 XLEADTECH_0 maps to Technician', async () => {
    query.mockResolvedValue([
      { XTECH_0: 'T3', XTECHNCN_0: 'tech', XPASSWRD_0: 'pw', XLEADTECH_0: 5 },
    ]);
    const res = await login('tech', 'pw').expect(200);
    expect(res.body.user.role).toBe('Technician');
  });

  it('unknown username returns a generic 401 (no username-exists oracle)', async () => {
    query.mockResolvedValue([]);
    const res = await login('nobody', 'pw').expect(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
    expect(res.body.message).not.toMatch(/not found|exist|username/i);
  });

  it('wrong password returns the SAME generic 401', async () => {
    query.mockResolvedValue([
      {
        XTECH_0: 'T1',
        XTECHNCN_0: 'jdoe',
        XPASSWRD_0: 'right',
        XLEADTECH_0: 1,
      },
    ]);
    const res = await login('jdoe', 'wrong').expect(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('validates the request body (missing password -> 400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/technician/login')
      .send({ username: 'jdoe' })
      .expect(400);
  });

  it('a SQL failure returns a safe error without leaking SQL/credentials', async () => {
    query.mockRejectedValue(
      Object.assign(new Error('ETIMEOUT internal'), { code: 'TIMEOUT_ERROR' }),
    );
    const res = await login('jdoe', 'pw');
    expect([502, 503, 504, 500]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
    expect(JSON.stringify(res.body)).not.toContain('XPASSWRD');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('preserves the correlation id', async () => {
    query.mockResolvedValue([
      { XTECH_0: 'T1', XTECHNCN_0: 'jdoe', XPASSWRD_0: 'pw', XLEADTECH_0: 1 },
    ]);
    const res = await request(app.getHttpServer())
      .post('/api/auth/technician/login')
      .set('x-correlation-id', 'TECH-CID-1')
      .send({ username: 'jdoe', password: 'pw' })
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('TECH-CID-1');
  });
});
