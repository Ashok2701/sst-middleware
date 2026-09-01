import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { setupSwagger } from '../src/swagger';

/**
 * Verifies Swagger mounting behaviour. `main.ts` decides whether to call
 * setupSwagger() based on the resolved `swaggerEnabled` config; these tests
 * exercise both the mounted and not-mounted outcomes directly.
 */
describe('Swagger (e2e)', () => {
  describe('when enabled', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication({ bufferLogs: true });
      setupApp(app);
      setupSwagger(app, '0.1.0');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('serves the OpenAPI JSON at /docs-json', async () => {
      const res = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);
      expect(res.body.openapi).toMatch(/^3\./);
      const paths = Object.keys(res.body.paths);
      expect(paths.sort()).toEqual([
        '/api/auth/sales-rep/login',
        '/api/auth/technician/login',
        '/api/routes',
        '/api/routes/{xdrn}',
        '/api/service-requests',
        '/api/service-requests/{id}',
        '/api/technicians',
        '/api/webhooks/worksuite',
        '/health',
        '/health/integrations',
        '/me',
        '/ready',
        '/version',
      ]);
    });

    it('does NOT include any future/invented integration endpoints', async () => {
      const res = await request(app.getHttpServer()).get('/docs-json');
      const paths = Object.keys(res.body.paths).join(' ').toLowerCase();
      // The WorkSuite webhook IS implemented (Phase 3.4); no OTHER worksuite
      // paths (e.g. contractor CRUD) or unimplemented integrations exist.
      expect(paths).not.toContain('lead-perfection');
      expect(paths).not.toContain('/sage');
      expect(paths).not.toContain('/sql');
      expect(paths).not.toContain('job-complete');
      expect(paths).not.toContain('purchase-receipt');
      expect(paths).not.toContain('/api/contractors');
    });

    it('serves Swagger UI at /docs', async () => {
      const res = await request(app.getHttpServer()).get('/docs').expect(200);
      expect(res.text.toLowerCase()).toContain('swagger-ui');
    });
  });

  describe('when disabled', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication({ bufferLogs: true });
      setupApp(app);
      // setupSwagger intentionally NOT called (simulates SWAGGER_ENABLED=false)
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('does not expose /docs-json', async () => {
      await request(app.getHttpServer()).get('/docs-json').expect(404);
    });

    it('does not expose /docs', async () => {
      await request(app.getHttpServer()).get('/docs').expect(404);
    });
  });
});
