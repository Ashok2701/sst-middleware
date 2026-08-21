import { TechnicianMapper } from './technician.mapper';

describe('TechnicianMapper', () => {
  const mapper = new TechnicianMapper();

  it('maps a full row to the canonical model', () => {
    const t = mapper.toCanonical({
      technicianId: 1001,
      name: 'Jane Doe',
      status: 'ACTIVE',
      branch: 'Denver',
      region: 'Mountain',
      crew: 'Crew-7',
      skills: ['install', 'service'],
    });
    expect(t).toEqual({
      technicianId: '1001',
      name: 'Jane Doe',
      status: 'ACTIVE',
      branch: 'Denver',
      region: 'Mountain',
      crew: 'Crew-7',
      skills: ['install', 'service'],
    });
  });

  it('parses a comma-separated skills string', () => {
    const t = mapper.toCanonical({ technicianId: 'T2', skills: 'a, b ,c' });
    expect(t.skills).toEqual(['a', 'b', 'c']);
  });

  it('omits optional fields that are null/empty and skills when absent', () => {
    const t = mapper.toCanonical({
      technicianId: 'T3',
      name: null,
      status: '',
    });
    expect(t).toEqual({
      technicianId: 'T3',
      name: undefined,
      status: undefined,
      branch: undefined,
      region: undefined,
      crew: undefined,
      skills: undefined,
    });
  });
});
