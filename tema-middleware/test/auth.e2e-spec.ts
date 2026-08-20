import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { setupApp } from '../src/setup';
import { AppModule } from '../src/app.module';

const SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e-secret';
const ISSUER = 'https://tema.test/';
const AUDIENCE = 'tema-middleware';

function sign(payload: object, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: '10m',
    ...options,
  });
}

/** Builds a fresh app with the given auth env (config reads env at load). */
async function buildApp(
  env: Record<string, string>,
): Promise<INestApplication> {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  setupApp(app);
  await app.init();
  process.env = saved;
  return app;
}

describe('Authentication (e2e)', () => {
  describe('when AUTH_ENABLED=true (dev provider)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp({
        NODE_ENV: 'test',
        AUTH_ENABLED: 'true',
        AUTH_PROVIDER: 'dev',
        AUTH_ISSUER: ISSUER,
        AUTH_AUDIENCE: AUDIENCE,
        AUTH_DEV_SECRET: SECRET,
        RATE_LIMIT_ENABLED: 'false',
      });
    });

    afterAll(async () => await app.close());

    it('keeps /health, /ready, /version PUBLIC', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/ready').expect(200);
      await request(app.getHttpServer()).get('/version').expect(200);
      await request(app.getHttpServer())
        .get('/health/integrations')
        .expect(200);
    });

    it('rejects a missing Authorization header (AUTHENTICATION_REQUIRED)', async () => {
      const res = await request(app.getHttpServer()).get('/me').expect(401);
      expect(res.body).toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
        requestId: expect.any(String),
      });
    });

    it.each(['Basic abc', 'Bearer', 'Token xyz', 'Bearer  '])(
      'rejects malformed Authorization header %p',
      async (header) => {
        const res = await request(app.getHttpServer())
          .get('/me')
          .set('Authorization', header)
          .expect(401);
        expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
      },
    );

    it('rejects an invalid signature (AUTHENTICATION_FAILED)', async () => {
      const bad = jwt.sign({ sub: 'u' }, 'other-secret-other-secret-other!!', {
        algorithm: 'HS256',
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: '5m',
      });
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${bad}`)
        .expect(401);
      expect(res.body.code).toBe('AUTHENTICATION_FAILED');
    });

    it('rejects an expired token (TOKEN_EXPIRED)', async () => {
      const token = sign({ sub: 'u' }, { expiresIn: -10 });
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects a wrong-audience token (AUTHENTICATION_FAILED)', async () => {
      const token = sign({ sub: 'u' }, { audience: 'someone-else' });
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(res.body.code).toBe('AUTHENTICATION_FAILED');
    });

    it('accepts a valid token and returns the authenticated user context', async () => {
      const token = sign({
        sub: 'user-42',
        preferred_username: 'jane',
        email: 'jane@example.com',
        roles: ['scheduler'],
      });
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        authenticated: true,
        user: {
          userId: 'user-42',
          username: 'jane',
          email: 'jane@example.com',
          roles: ['scheduler'],
          identityProvider: 'dev',
        },
      });
    });

    it('never leaks the token in an auth error response', async () => {
      const token = sign({ sub: 'u' }, { expiresIn: -10 });
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(JSON.stringify(res.body)).not.toContain(token);
      expect(res.body).not.toHaveProperty('stack');
    });

    it('includes a correlation id and echoes a provided one on auth failure', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('x-correlation-id', 'AUTH-CID-1')
        .expect(401);
      expect(res.headers['x-correlation-id']).toBe('AUTH-CID-1');
      expect(res.body.requestId).toBe('AUTH-CID-1');
    });
  });

  describe('when AUTH_ENABLED=false', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp({ NODE_ENV: 'test', AUTH_ENABLED: 'false' });
    });

    afterAll(async () => await app.close());

    it('allows /me without a token and reports auth disabled', async () => {
      const res = await request(app.getHttpServer()).get('/me').expect(200);
      expect(res.body).toEqual({
        authenticated: false,
        message: 'Authentication is disabled',
      });
    });
  });
});
