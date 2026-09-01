import { SalesRepMapper } from './sales-rep.mapper';

describe('SalesRepMapper', () => {
  const mapper = new SalesRepMapper();

  it('is eligible only when role=1 AND active=1', () => {
    expect(mapper.isEligible({ XUSROLE_0: 1, XACT_0: 1 })).toBe(true);
    expect(mapper.isEligible({ XUSROLE_0: 2, XACT_0: 1 })).toBe(false); // not sales rep
    expect(mapper.isEligible({ XUSROLE_0: 1, XACT_0: 2 })).toBe(false); // inactive
  });

  it('maps user + site rows to canonical identity (never includes password)', () => {
    const id = mapper.toIdentity(
      {
        XAUS_0: 'SREP01',
        XAUSNA_0: 'Jane Rep',
        XEMAILID_0: 'jane@x.com',
        XPWSD_0: 'secret',
      },
      [
        { XFCY_0: 'USA01', XDEFFCY_0: 1 },
        { XFCY_0: 'USA02', XDEFFCY_0: 2 },
      ],
    );
    expect(id).toMatchObject({
      salesRepId: 'SREP01',
      username: 'SREP01',
      name: 'Jane Rep',
      email: 'jane@x.com',
      role: 'Sales Rep',
      sites: ['USA01', 'USA02'],
      defaultSite: 'USA02',
    });
    expect(JSON.stringify(id)).not.toContain('secret');
  });

  it('falls back to the first site when no default flag is set', () => {
    const id = mapper.toIdentity({ XAUS_0: 'S1' }, [
      { XFCY_0: 'A' },
      { XFCY_0: 'B' },
    ]);
    expect(id?.defaultSite).toBe('A');
  });

  it('returns undefined without a user id', () => {
    expect(mapper.toIdentity({}, [])).toBeUndefined();
  });
});
