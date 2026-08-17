import loadConfiguration from './configuration';

describe('configuration - swaggerEnabled', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  function withEnv(env: Record<string, string | undefined>) {
    process.env = { ...original, ...env };
    delete (process.env as any).SWAGGER_ENABLED;
    if (env.SWAGGER_ENABLED !== undefined) {
      process.env.SWAGGER_ENABLED = env.SWAGGER_ENABLED;
    }
    return loadConfiguration();
  }

  it('is enabled by default in development', () => {
    expect(withEnv({ NODE_ENV: 'development' }).swaggerEnabled).toBe(true);
  });

  it('is enabled by default in test', () => {
    expect(withEnv({ NODE_ENV: 'test' }).swaggerEnabled).toBe(true);
  });

  it('is disabled by default in production', () => {
    expect(withEnv({ NODE_ENV: 'production' }).swaggerEnabled).toBe(false);
  });

  it('can be explicitly enabled in production', () => {
    expect(
      withEnv({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })
        .swaggerEnabled,
    ).toBe(true);
  });

  it('can be explicitly disabled in development', () => {
    expect(
      withEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' })
        .swaggerEnabled,
    ).toBe(false);
  });
});
