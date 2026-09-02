/**
 * WorkSuite webhook event vocabulary (Phase 3.8).
 *
 * WorkSuite has NOT yet confirmed the final event strings, JSON casing, or
 * structure. To avoid guessing, the raw WorkSuite event string is resolved to a
 * stable internal `WorksuiteLogicalEvent` through a CONFIGURABLE alias map.
 * Sensible defaults (including the legacy Phase 3.4-3.7 strings) are provided so
 * nothing breaks today; the real WorkSuite strings can be plugged in later via
 * `WORKSUITE_EVENT_*` env vars WITHOUT code changes.
 *
 * Matching is case-insensitive because the final casing is TBD.
 */
export enum WorksuiteLogicalEvent {
  ContractorCreated = 'CONTRACTOR_CREATED',
  ContractorUpdated = 'CONTRACTOR_UPDATED',
  /** Generic activation / deactivation: fetch latest + apply WorkSuite status. */
  ContractorStatusChanged = 'CONTRACTOR_STATUS_CHANGED',
  ProfileUpdated = 'PROFILE_UPDATED',
  CompanyUpdated = 'COMPANY_UPDATED',
  /** Legacy lifecycle events preserved from earlier phases (behavior unchanged). */
  ContractorArchived = 'CONTRACTOR_ARCHIVED',
  ContractorReactivated = 'CONTRACTOR_REACTIVATED',
}

/** Env var carrying comma-separated raw event aliases for each logical event. */
const ENV_KEYS: Record<WorksuiteLogicalEvent, string> = {
  [WorksuiteLogicalEvent.ContractorCreated]:
    'WORKSUITE_EVENT_CONTRACTOR_CREATED',
  [WorksuiteLogicalEvent.ContractorUpdated]:
    'WORKSUITE_EVENT_CONTRACTOR_UPDATED',
  [WorksuiteLogicalEvent.ContractorStatusChanged]:
    'WORKSUITE_EVENT_CONTRACTOR_STATUS',
  [WorksuiteLogicalEvent.ProfileUpdated]: 'WORKSUITE_EVENT_PROFILE_UPDATED',
  [WorksuiteLogicalEvent.CompanyUpdated]: 'WORKSUITE_EVENT_COMPANY_UPDATED',
  [WorksuiteLogicalEvent.ContractorArchived]:
    'WORKSUITE_EVENT_CONTRACTOR_ARCHIVED',
  [WorksuiteLogicalEvent.ContractorReactivated]:
    'WORKSUITE_EVENT_CONTRACTOR_REACTIVATED',
};

/** Default raw aliases (normalized lowercase) per logical event. PENDING WorkSuite. */
const DEFAULT_ALIASES: Record<WorksuiteLogicalEvent, string[]> = {
  [WorksuiteLogicalEvent.ContractorCreated]: [
    'contractor.created',
    'contractor_created',
  ],
  [WorksuiteLogicalEvent.ContractorUpdated]: [
    'contractor.updated',
    'contractor_updated',
  ],
  [WorksuiteLogicalEvent.ContractorStatusChanged]: [
    'contractor.activated',
    'contractor_activated',
    'contractor.deactivated',
    'contractor_deactivated',
    'contractor.status_changed',
    'contractor_status_changed',
  ],
  [WorksuiteLogicalEvent.ProfileUpdated]: [
    'profile.updated',
    'profile_updated',
    'contractor.profile_updated',
    'contractor_profile_updated',
  ],
  [WorksuiteLogicalEvent.CompanyUpdated]: [
    'company.updated',
    'company_updated',
  ],
  [WorksuiteLogicalEvent.ContractorArchived]: [
    'contractor.archived',
    'contractor_archived',
  ],
  [WorksuiteLogicalEvent.ContractorReactivated]: [
    'contractor.reactivated',
    'contractor_reactivated',
  ],
};

export function normalizeEventKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Builds the raw-string -> logical-event alias map from defaults plus any
 * `WORKSUITE_EVENT_*` env overrides (comma-separated). Env aliases are ADDED to
 * the defaults so the confirmed WorkSuite strings can be introduced later.
 */
export function buildEventAliases(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, WorksuiteLogicalEvent> {
  const map: Record<string, WorksuiteLogicalEvent> = {};
  for (const logical of Object.values(WorksuiteLogicalEvent)) {
    const aliases = [...DEFAULT_ALIASES[logical]];
    const override = env[ENV_KEYS[logical]];
    if (override) {
      for (const part of override.split(',')) {
        const key = normalizeEventKey(part);
        if (key) aliases.push(key);
      }
    }
    for (const alias of aliases) map[alias] = logical;
  }
  return map;
}

/** Resolves a raw WorkSuite event string to a logical event, or undefined. */
export function resolveLogicalEvent(
  rawEvent: string | undefined,
  aliases: Record<string, WorksuiteLogicalEvent>,
): WorksuiteLogicalEvent | undefined {
  if (!rawEvent) return undefined;
  return aliases[normalizeEventKey(rawEvent)];
}
