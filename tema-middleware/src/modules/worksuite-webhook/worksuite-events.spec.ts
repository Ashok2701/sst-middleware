import {
  buildEventAliases,
  resolveLogicalEvent,
  WorksuiteLogicalEvent,
} from './worksuite-events';

describe('worksuite-events (config-driven event resolution)', () => {
  it('resolves the default (legacy) event strings', () => {
    const aliases = buildEventAliases({});
    expect(resolveLogicalEvent('contractor.created', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorCreated,
    );
    expect(resolveLogicalEvent('contractor.updated', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorUpdated,
    );
    expect(resolveLogicalEvent('contractor.archived', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorArchived,
    );
    expect(resolveLogicalEvent('contractor.reactivated', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorReactivated,
    );
  });

  it('resolves the five logical events including status/profile/company', () => {
    const aliases = buildEventAliases({});
    expect(resolveLogicalEvent('contractor.deactivated', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorStatusChanged,
    );
    expect(resolveLogicalEvent('profile.updated', aliases)).toBe(
      WorksuiteLogicalEvent.ProfileUpdated,
    );
    expect(resolveLogicalEvent('company.updated', aliases)).toBe(
      WorksuiteLogicalEvent.CompanyUpdated,
    );
  });

  it('is case-insensitive (casing is TBD)', () => {
    const aliases = buildEventAliases({});
    expect(resolveLogicalEvent('CONTRACTOR_CREATED', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorCreated,
    );
    expect(resolveLogicalEvent('  Profile.Updated  ', aliases)).toBe(
      WorksuiteLogicalEvent.ProfileUpdated,
    );
  });

  it('returns undefined for unknown / empty events', () => {
    const aliases = buildEventAliases({});
    expect(resolveLogicalEvent('something.else', aliases)).toBeUndefined();
    expect(resolveLogicalEvent(undefined, aliases)).toBeUndefined();
  });

  it('lets env aliases plug in the confirmed WorkSuite strings later', () => {
    const aliases = buildEventAliases({
      WORKSUITE_EVENT_CONTRACTOR_CREATED: 'partner.onboarded, NEW_PARTNER',
    });
    expect(resolveLogicalEvent('partner.onboarded', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorCreated,
    );
    expect(resolveLogicalEvent('new_partner', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorCreated,
    );
    // Defaults remain intact.
    expect(resolveLogicalEvent('contractor.created', aliases)).toBe(
      WorksuiteLogicalEvent.ContractorCreated,
    );
  });
});
