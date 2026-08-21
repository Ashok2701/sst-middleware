import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../src/common/integration/errors/integration-error';
import { SqlServerAdapter } from '../src/integrations/sql-server/sql-server.adapter';
import { setupApp } from '../src/setup';

const SECRET = 'tech-secret-tech-secret-tech-secret-tech!!';
const ISSUER = 'https://tema.test/';
const AUDIENCE = 'tema-middleware';

function sign(payload: object): string {
  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: '10m',
  });
}

describe('GET /api/technicians (e2e)', () => {
  let app: INestApplication;
  const executeStoredProcedure = jest.fn();

  const sqlMock = {
    name: 'sql-server',
    targetSystem: 'SQL Server',
    enabled: true,
    executeStoredProcedure,
    query: jest.fn(),
    checkConnectivity: jest.fn().mockResolvedValue({
      name: 'sql-server',
      targetSystem: 'SQL Server',
      status: 'UP',
      enabled: true,
    }),
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
      SQL_TECHNICIANS_PROCEDURE: 'usp_test_get_technicians',
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
  beforeEach(() => executeStoredProcedure.mockReset());

  const readToken = () =>
    `Bearer ${sign({ sub: 'sched-1', permissions: ['technician.read'] })}`;

  it('requires authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .expect(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('requires the technician.read permission (403)', async () => {
    const token = `Bearer ${sign({ sub: 'u', permissions: ['other.read'] })}`;
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', token)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns technicians for an authorized caller', async () => {
    executeStoredProcedure.mockResolvedValue([
      {
        technicianId: 'T1',
        name: 'Jane',
        status: 'ACTIVE',
        skills: 'install,service',
      },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', readToken())
      .expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.technicians[0]).toMatchObject({
      technicianId: 'T1',
      name: 'Jane',
      status: 'ACTIVE',
      skills: ['install', 'service'],
    });
  });

  it('handles an empty result', async () => {
    executeStoredProcedure.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', readToken())
      .expect(200);
    expect(res.body).toEqual({ technicians: [], count: 0 });
  });

  it('maps a SQL timeout to a safe error (no raw SQL / credentials)', async () => {
    executeStoredProcedure.mockRejectedValue(
      new IntegrationError(IntegrationErrorCode.TIMEOUT_ERROR, {
        internalDetails: { server: 'db-internal', password: 'p@ss' },
      }),
    );
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', readToken())
      .expect(504);
    expect(res.body).toEqual({
      code: 'TIMEOUT_ERROR',
      message: expect.any(String),
      requestId: expect.any(String),
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('p@ss');
    expect(raw).not.toContain('db-internal');
    expect(raw).not.toContain('usp_test_get_technicians');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('maps a SQL connection failure to a safe 502', async () => {
    executeStoredProcedure.mockRejectedValue(
      new IntegrationError(IntegrationErrorCode.CONNECTION_ERROR),
    );
    await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', readToken())
      .expect(502);
  });

  it('propagates and preserves the correlation id', async () => {
    executeStoredProcedure.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get('/api/technicians')
      .set('Authorization', readToken())
      .set('x-correlation-id', 'TECH-CID-1')
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('TECH-CID-1');
  });

  it('keeps /health public and unaffected', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
