import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';

/**
 * Verifies the Phase 2 integration foundation boots with integrations DISABLED
 * (the default) and that existing Phase 1/1.5 semantics are intact.
 */
describe('Integrations (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps /health and /ready intact', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('UP'));
    await request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('READY'));
  });

  it('exposes /health/integrations with DISABLED adapters and no secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/integrations')
      .expect(200);

    const byName = Object.fromEntries(
      res.body.integrations.map((i: any) => [i.name, i]),
    );
    expect(byName['sql-server'].status).toBe('DISABLED');
    expect(byName['sage-x3'].status).toBe('DISABLED');
    expect(byName['sql-server'].enabled).toBe(false);

    const raw = JSON.stringify(res.body).toLowerCase();
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('connectionstring');
    expect(raw).not.toContain('apikey');
  });

  it('still returns consistent error envelope for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/nope').expect(404);
    expect(res.body).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    });
  });
});
