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
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
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
});
