/**
 * Central, typed configuration loaded from environment variables.
 * No secrets or real URLs live here - only how env vars map to config keys.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  temaBaseUrl?: string;
  fsmScheduler: {
    baseUrl?: string;
    port?: number;
  };
  databaseUrl?: string;
  logLevel: string;
  swaggerEnabled: boolean;
}

/**
 * Resolves whether Swagger should be enabled.
 * - If SWAGGER_ENABLED is set explicitly, that wins (allows prod opt-in).
 * - Otherwise: enabled for development & test, disabled for production.
 */
function resolveSwaggerEnabled(nodeEnv: string): boolean {
  if (process.env.SWAGGER_ENABLED !== undefined) {
    return process.env.SWAGGER_ENABLED.toLowerCase() === 'true';
  }
  return nodeEnv !== 'production';
}

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.TEMA_PORT ?? '8081', 10),
    temaBaseUrl: process.env.TEMA_BASE_URL,
    fsmScheduler: {
      baseUrl: process.env.FSM_SCHEDULER_BASE_URL,
      port: process.env.FSM_SCHEDULER_PORT
        ? parseInt(process.env.FSM_SCHEDULER_PORT, 10)
        : undefined,
    },
    databaseUrl: process.env.DATABASE_URL,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    swaggerEnabled: resolveSwaggerEnabled(nodeEnv),
  };
};
