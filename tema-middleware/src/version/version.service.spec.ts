import { VersionService } from './version.service';

describe('VersionService', () => {
  it('returns the service name and a version string', () => {
    const result = new VersionService().getVersion();
    expect(result.service).toBe('tema-middleware');
    expect(typeof result.version).toBe('string');
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
