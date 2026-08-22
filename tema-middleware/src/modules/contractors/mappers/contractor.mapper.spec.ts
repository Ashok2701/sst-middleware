import { ContractorMapper } from './contractor.mapper';
import { ContractorRole } from '../models/contractor.model';
import { IntegrationError } from '../../../common/integration/errors/integration-error';

describe('ContractorMapper', () => {
  const mapper = new ContractorMapper();

  it('maps a full payload to the canonical contractor (no Branch/Region)', () => {
    const c = mapper.toCanonical({
      id: 'ws-100',
      partnerId: 'P-1',
      companyId: 'CO-1',
      role: 'Technician',
      status: 'active',
      crew: 'Crew-7',
    });
    expect(c).toMatchObject({
      worksuiteContractorId: 'ws-100',
      partnerId: 'P-1',
      companyId: 'CO-1',
      role: ContractorRole.Technician,
      active: true,
      crew: 'Crew-7',
    });
    expect(c).not.toHaveProperty('branch');
    expect(c).not.toHaveProperty('region');
  });

  it('accepts only the four confirmed roles; unknown -> undefined', () => {
    expect(mapper.toCanonical({ id: 'a', role: 'Lead Technician' }).role).toBe(
      ContractorRole.LeadTechnician,
    );
    expect(mapper.toCanonical({ id: 'a', role: 'Sales Rep' }).role).toBe(
      ContractorRole.SalesRep,
    );
    expect(mapper.toCanonical({ id: 'a', role: 'N/A' }).role).toBe(
      ContractorRole.NA,
    );
    expect(
      mapper.toCanonical({ id: 'a', role: 'Manager' }).role,
    ).toBeUndefined();
  });

  it('derives active=false for archived/inactive statuses', () => {
    expect(mapper.toCanonical({ id: 'a', status: 'archived' }).active).toBe(
      false,
    );
    expect(mapper.toCanonical({ id: 'a', active: false }).active).toBe(false);
    expect(mapper.toCanonical({ id: 'a' }).active).toBe(true);
  });

  it('extracts a hashed credential without ever accepting plaintext', () => {
    const c = mapper.toCanonical({
      id: 'a',
      passwordHash: 'ABC123',
      passwordSalt: 'SALT',
      iterations: 600000,
      keyLength: 32,
      encoding: 'base64url',
    });
    expect(c.credential).toMatchObject({
      algorithm: 'PBKDF2-SHA256',
      hash: 'ABC123',
      salt: 'SALT',
      iterations: 600000,
    });
  });

  it('uses the fallback id from the webhook when payload lacks one', () => {
    expect(
      mapper.toCanonical({ role: 'Technician' }, 'fallback-9')
        .worksuiteContractorId,
    ).toBe('fallback-9');
  });

  it('throws TRANSFORMATION_ERROR when no id is resolvable', () => {
    expect(() => mapper.toCanonical({ role: 'Technician' })).toThrow(
      IntegrationError,
    );
  });
});
