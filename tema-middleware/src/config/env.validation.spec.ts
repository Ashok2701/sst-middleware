import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applies sensible defaults when nothing is provided', () => {
    const cfg = validateEnv({});
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.TEMA_PORT).toBe(8081);
    expect(cfg.LOG_LEVEL).toBe('info');
  });

  it('coerces numeric ports from strings', () => {
    const cfg = validateEnv({ TEMA_PORT: '9090', FSM_SCHEDULER_PORT: '8082' });
    expect(cfg.TEMA_PORT).toBe(9090);
    expect(cfg.FSM_SCHEDULER_PORT).toBe(8082);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging-invalid' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an invalid LOG_LEVEL', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'loud' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
