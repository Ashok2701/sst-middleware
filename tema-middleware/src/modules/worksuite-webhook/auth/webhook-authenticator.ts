import { ConfigService } from '@nestjs/config';
import { WorksuiteConfig } from '../../../config/configuration';
import { verifyWorksuiteSignature } from '../signature/worksuite-signature';

/**
 * Pluggable WorkSuite webhook authentication (Phase 3.8).
 *
 * CRITICAL: WorkSuite has NOT yet provided the final webhook authentication
 * specification (algorithm, headers, secret format, timestamp unit, replay
 * window). This abstraction lets the confirmed mechanism be inserted later
 * WITHOUT touching the webhook orchestration. The only implementation today is
 * the TEMPORARY HMAC-SHA256 verifier (selected via `WORKSUITE_WEBHOOK_AUTH_MODE`,
 * default `hmac-sha256`). Nothing about the auth contract is treated as final.
 */
export interface WebhookVerifyInput {
  rawBody: Buffer;
  timestamp?: string;
  signature?: string;
}

export interface WebhookAuthenticator {
  readonly mode: string;
  /** True once the mechanism has the material it needs (e.g. a shared secret). */
  isConfigured(): boolean;
  /** Constant-time verification of the request. Never logs/returns secrets. */
  verify(input: WebhookVerifyInput): boolean;
}

export const WEBHOOK_AUTHENTICATOR = Symbol('WEBHOOK_AUTHENTICATOR');

/**
 * TEMPORARY HMAC-SHA256 authenticator. Uses the RAW body + timestamp freshness
 * with a constant-time signature comparison. PENDING WorkSuite's final spec.
 */
export class HmacWebhookAuthenticator implements WebhookAuthenticator {
  readonly mode = 'hmac-sha256';
  private readonly cfg: WorksuiteConfig;

  constructor(config: ConfigService) {
    this.cfg = config.get<WorksuiteConfig>('worksuite')!;
  }

  isConfigured(): boolean {
    return Boolean(this.cfg.webhook.secret);
  }

  verify(input: WebhookVerifyInput): boolean {
    return verifyWorksuiteSignature({
      rawBody: input.rawBody,
      timestamp: input.timestamp,
      signature: input.signature,
      secret: this.cfg.webhook.secret ?? '',
      toleranceSeconds: this.cfg.webhook.toleranceSeconds,
    });
  }
}

/**
 * Factory selecting the authenticator by configured mode. Extend here when
 * WorkSuite confirms the real mechanism; the default remains HMAC-SHA256.
 */
export function createWebhookAuthenticator(
  config: ConfigService,
): WebhookAuthenticator {
  const cfg = config.get<WorksuiteConfig>('worksuite')!;
  switch (cfg.webhook.authMode) {
    case 'hmac-sha256':
    default:
      return new HmacWebhookAuthenticator(config);
  }
}
