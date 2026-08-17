import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { CORRELATION_ID_HEADER } from '../src/common/correlation/correlation.constants';

describe('Application foundation (e2e)', () => {
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

  describe('GET /health', () => {
    it('returns status UP', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'UP', service: 'tema-middleware' });
    });
  });

  describe('GET /ready', () => {
    it('reports the service is ready', async () => {
      const res = await request(app.getHttpServer()).get('/ready').expect(200);
      expect(res.body).toMatchObject({
        status: 'READY',
        service: 'tema-middleware',
      });
    });
  });

  describe('GET /version', () => {
    it('returns the service name and version', async () => {
      const res = await request(app.getHttpServer())
        .get('/version')
        .expect(200);
      expect(res.body.service).toBe('tema-middleware');
      expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Correlation id', () => {
    it('generates a correlation id when none is provided', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers[CORRELATION_ID_HEADER]).toBeDefined();
      expect(res.headers[CORRELATION_ID_HEADER].length).toBeGreaterThan(0);
    });

    it('propagates a caller-provided correlation id', async () => {
      const provided = 'e2e-correlation-id-42';
      const res = await request(app.getHttpServer())
        .get('/health')
        .set(CORRELATION_ID_HEADER, provided)
        .expect(200);
      expect(res.headers[CORRELATION_ID_HEADER]).toBe(provided);
    });
  });

  describe('Global error handling', () => {
    it('returns a consistent error payload for unknown routes', async () => {
      const res = await request(app.getHttpServer())
        .get('/does-not-exist')
        .expect(404);
      expect(res.body).toMatchObject({
        code: 'NOT_FOUND',
        requestId: expect.any(String),
      });
      expect(res.body).toHaveProperty('message');
      expect(res.body).not.toHaveProperty('stack');
    });
  });
});
