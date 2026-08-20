import { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from './authorization.service';

function user(partial: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'u1',
    roles: [],
    permissions: [],
    identityProvider: 'dev',
    ...partial,
  };
}

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it('allows when there is no requirement', () => {
    expect(
      service.authorize(user(), { roles: [], permissions: [] }).allowed,
    ).toBe(true);
  });

  it('allows when the user has one of the required roles (OR)', () => {
    const d = service.authorize(user({ roles: ['TECHNICIAN'] }), {
      roles: ['ADMIN', 'TECHNICIAN'],
      permissions: [],
    });
    expect(d.allowed).toBe(true);
  });

  it('denies when the user lacks the required role', () => {
    const d = service.authorize(user({ roles: ['SALES'] }), {
      roles: ['TECHNICIAN'],
      permissions: [],
    });
    expect(d).toEqual({ allowed: false, failedOn: 'role' });
  });

  it('allows when the user has one of the required permissions (OR)', () => {
    const d = service.authorize(user({ permissions: ['job.read'] }), {
      roles: [],
      permissions: ['job.read', 'job.update'],
    });
    expect(d.allowed).toBe(true);
  });

  it('denies when the user lacks the required permission', () => {
    const d = service.authorize(user({ permissions: ['job.read'] }), {
      roles: [],
      permissions: ['job.update'],
    });
    expect(d).toEqual({ allowed: false, failedOn: 'permission' });
  });

  it('requires BOTH role AND permission when both are specified', () => {
    const req = { roles: ['TECHNICIAN'], permissions: ['job.update'] };
    expect(service.authorize(user({ roles: ['TECHNICIAN'] }), req)).toEqual({
      allowed: false,
      failedOn: 'permission',
    });
    expect(
      service.authorize(user({ permissions: ['job.update'] }), req),
    ).toEqual({ allowed: false, failedOn: 'role' });
    expect(
      service.authorize(
        user({ roles: ['TECHNICIAN'], permissions: ['job.update'] }),
        req,
      ).allowed,
    ).toBe(true);
  });

  it('fails closed for empty user roles/permissions against a requirement', () => {
    expect(
      service.authorize(user(), { roles: ['ADMIN'], permissions: [] }).allowed,
    ).toBe(false);
    expect(
      service.authorize(user(), { roles: [], permissions: ['x'] }).allowed,
    ).toBe(false);
  });
});
