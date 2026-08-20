import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Permissions } from '../src/common/authorization/permissions.decorator';
import { Roles } from '../src/common/authorization/roles.decorator';
import { setupApp } from '../src/setup';

const SECRET = 'authz-secret-authz-secret-authz-secret-authz';
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

/** Test-only controller (NOT part of the production app) exercising the guards. */
@Controller('__authz')
class AuthzTestController {
  @Get('open')
  open() {
    return { ok: 'open' };
  }

  @Get('role-tech')
  @Roles('TECHNICIAN')
  roleTech() {
    return { ok: 'role' };
  }

  @Get('perm-jobread')
  @Permissions('job.read')
  permJobRead() {
    return { ok: 'perm' };
  }

  @Get('combined')
  @Roles('TECHNICIAN')
  @Permissions('job.update')
  combined() {
    return { ok: 'combined' };
  }
}

describe('Authorization / RBAC (e2e)', () => {
  let app: INestApplication;

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
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuthzTestController],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
    process.env = saved;
  });

  afterAll(async () => await app.close());

  const auth = (payload: object) => ({
    Authorization: `Bearer ${sign(payload)}`,
  });

  it('public endpoints remain accessible without a token', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/ready').expect(200);
    await request(app.getHttpServer()).get('/version').expect(200);
    await request(app.getHttpServer()).get('/health/integrations').expect(200);
  });

  it('unauthenticated request to a protected route -> 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/__authz/role-tech')
      .expect(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('authenticated user reaches a route with no authz metadata (authN only)', async () => {
    const res = await request(app.getHttpServer())
      .get('/__authz/open')
      .set(auth({ sub: 'u', roles: [], permissions: [] }))
      .expect(200);
    expect(res.body).toEqual({ ok: 'open' });
  });

  describe('roles', () => {
    it('allows when the required role is present', async () => {
      await request(app.getHttpServer())
        .get('/__authz/role-tech')
        .set(auth({ sub: 'u', roles: ['TECHNICIAN'] }))
        .expect(200);
    });

    it('forbids (403) when the required role is absent', async () => {
      const res = await request(app.getHttpServer())
        .get('/__authz/role-tech')
        .set(auth({ sub: 'u', roles: ['SALES'] }))
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'FORBIDDEN',
        requestId: expect.any(String),
      });
    });
  });

  describe('permissions', () => {
    it('allows when the required permission is present', async () => {
      await request(app.getHttpServer())
        .get('/__authz/perm-jobread')
        .set(auth({ sub: 'u', permissions: ['job.read'] }))
        .expect(200);
    });

    it('forbids (403) when the required permission is absent', async () => {
      await request(app.getHttpServer())
        .get('/__authz/perm-jobread')
        .set(auth({ sub: 'u', permissions: ['job.update'] }))
        .expect(403);
    });
  });

  describe('combined role + permission (AND)', () => {
    it('allows only when BOTH are satisfied', async () => {
      await request(app.getHttpServer())
        .get('/__authz/combined')
        .set(
          auth({
            sub: 'u',
            roles: ['TECHNICIAN'],
            permissions: ['job.update'],
          }),
        )
        .expect(200);
    });

    it('forbids when only the role is present', async () => {
      await request(app.getHttpServer())
        .get('/__authz/combined')
        .set(auth({ sub: 'u', roles: ['TECHNICIAN'] }))
        .expect(403);
    });

    it('forbids when only the permission is present', async () => {
      await request(app.getHttpServer())
        .get('/__authz/combined')
        .set(auth({ sub: 'u', permissions: ['job.update'] }))
        .expect(403);
    });
  });

  it('never leaks token/claims/stack in a 403 response and keeps correlation id', async () => {
    const token = sign({ sub: 'secretuser', roles: ['SALES'] });
    const res = await request(app.getHttpServer())
      .get('/__authz/role-tech')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'AUTHZ-CID-1')
      .expect(403);
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(JSON.stringify(res.body)).not.toContain('secretuser');
    expect(res.body).not.toHaveProperty('stack');
    expect(res.headers['x-correlation-id']).toBe('AUTHZ-CID-1');
    expect(res.body.requestId).toBe('AUTHZ-CID-1');
  });
});
