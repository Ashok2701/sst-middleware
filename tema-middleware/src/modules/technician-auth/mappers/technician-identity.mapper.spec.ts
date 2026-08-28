import { TechnicianIdentityMapper } from './technician-identity.mapper';
import { TechnicianRole } from '../models/technician-identity.model';

describe('TechnicianIdentityMapper', () => {
  const mapper = new TechnicianIdentityMapper();

  it('maps XTECH_0 -> technicianId and XTECHNCN_0 -> username', () => {
    const id = mapper.toIdentity({
      XTECH_0: 'TECH001',
      XTECHNCN_0: 'jdoe',
      XLEADTECH_0: 1,
    });
    expect(id).toEqual({
      technicianId: 'TECH001',
      username: 'jdoe',
      role: TechnicianRole.Technician,
    });
  });

  it('XLEADTECH_0 = 2 maps to Lead Technician', () => {
    expect(mapper.resolveRole(2)).toBe(TechnicianRole.LeadTechnician);
    expect(mapper.resolveRole('2')).toBe(TechnicianRole.LeadTechnician);
  });

  it('any non-2 XLEADTECH_0 maps to Technician', () => {
    expect(mapper.resolveRole(1)).toBe(TechnicianRole.Technician);
    expect(mapper.resolveRole(0)).toBe(TechnicianRole.Technician);
    expect(mapper.resolveRole(null)).toBe(TechnicianRole.Technician);
    expect(mapper.resolveRole(undefined)).toBe(TechnicianRole.Technician);
    expect(mapper.resolveRole('x')).toBe(TechnicianRole.Technician);
  });

  it('returns undefined when required identity fields are missing', () => {
    expect(mapper.toIdentity({ XTECHNCN_0: 'jdoe' })).toBeUndefined();
    expect(mapper.toIdentity({ XTECH_0: 'TECH001' })).toBeUndefined();
  });

  it('reads the stored password separately (not part of identity)', () => {
    const row = { XTECH_0: 'T1', XTECHNCN_0: 'u', XPASSWRD_0: 'secretpw' };
    expect(mapper.readStoredPassword(row)).toBe('secretpw');
    const id = mapper.toIdentity(row)!;
    expect(JSON.stringify(id)).not.toContain('secretpw');
    expect(id).not.toHaveProperty('password');
  });
});
