import { AuditOutcome } from '../../common/audit/audit-event.model';
import { InMemoryContractorStore } from './contractor-store';
import { ContractorsService } from './contractors.service';
import { ContractorMapper } from './mappers/contractor.mapper';
import { ContractorRole } from './models/contractor.model';

describe('ContractorsService', () => {
  let service: ContractorsService;
  let store: InMemoryContractorStore;
  const getContractor = jest.fn();
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const adapter = { getContractor } as any;
  const audit = { record: auditRecord } as any;
  const verifier = { verify: jest.fn() } as any;

  beforeEach(() => {
    store = new InMemoryContractorStore();
    service = new ContractorsService(
      adapter,
      new ContractorMapper(),
      store,
      verifier,
      audit,
    );
    getContractor.mockReset();
    auditRecord.mockClear();
  });

  it('creates/updates a contractor by pulling the current record', async () => {
    getContractor.mockResolvedValue({
      id: 'ws-1',
      role: 'Technician',
      status: 'active',
    });
    const c = await service.syncFromWorksuite(
      'ws-1',
      'WORKSUITE_CONTRACTOR_CREATED',
    );
    expect(getContractor).toHaveBeenCalledWith('ws-1');
    expect(c.role).toBe(ContractorRole.Technician);
    expect(await store.findById('ws-1')).toBeDefined();
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WORKSUITE_CONTRACTOR_CREATED',
        outcome: AuditOutcome.Success,
      }),
    );
  });

  it('reactivate forces active=true even if payload says inactive', async () => {
    getContractor.mockResolvedValue({ id: 'ws-2', status: 'inactive' });
    const c = await service.syncFromWorksuite(
      'ws-2',
      'WORKSUITE_CONTRACTOR_REACTIVATED',
      true,
    );
    expect(c.active).toBe(true);
  });

  it('archive disables access without pulling the record', async () => {
    getContractor.mockResolvedValue({ id: 'ws-3', status: 'active' });
    await service.syncFromWorksuite('ws-3', 'WORKSUITE_CONTRACTOR_CREATED');
    getContractor.mockClear();
    await service.archive('ws-3', 'WORKSUITE_CONTRACTOR_ARCHIVED');
    expect(getContractor).not.toHaveBeenCalled();
    expect((await store.findById('ws-3'))?.active).toBe(false);
  });

  it('audit metadata never includes the credential hash', async () => {
    getContractor.mockResolvedValue({
      id: 'ws-4',
      role: 'Technician',
      passwordHash: 'SUPER-SECRET-HASH',
      passwordSalt: 'SALT',
    });
    await service.syncFromWorksuite('ws-4', 'WORKSUITE_CONTRACTOR_UPDATED');
    const auditCall = JSON.stringify(auditRecord.mock.calls);
    expect(auditCall).not.toContain('SUPER-SECRET-HASH');
    expect(auditCall).toContain('"hasCredential":true');
  });

  it('delegates password verification to the verifier', async () => {
    verifier.verify.mockResolvedValue(true);
    const ok = await service.verifyPassword(
      { algorithm: 'PBKDF2-SHA256', hash: 'h', salt: 's' },
      'pw',
    );
    expect(ok).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('pw', expect.any(Object));
  });
});
