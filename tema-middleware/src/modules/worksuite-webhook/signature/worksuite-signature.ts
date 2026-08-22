import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * WorkSuite webhook HMAC-SHA256 signature verification.
 *
 * Proposed by WorkSuite:
 *   signature = "sha256=" + hex( HMAC-SHA256(shared_secret, "{timestamp}.{raw_body}") )
 *   headers: X-Worksuite-Timestamp, X-Worksuite-Signature, X-Worksuite-Event-Id
 *
 * Requirements enforced here:
 *   - use the RAW request body bytes (never a re-serialized JSON body),
 *   - constant-time comparison with a length guard,
 *   - configurable timestamp freshness / replay tolerance.
 *
 * PENDING: WorkSuite must confirm the timestamp UNIT. This assumes Unix SECONDS.
 */
export interface SignatureInput {
  rawBody: Buffer;
  timestamp?: string;
  signature?: string;
  secret: string;
  toleranceSeconds: number;
  /** Injectable clock for deterministic tests (Unix seconds). */
  nowSeconds?: number;
}

const SIGNATURE_RE = /^sha256=([0-9a-fA-F]{64})$/;

/** Length-safe constant-time buffer comparison. */
export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWorksuiteSignature(input: SignatureInput): boolean {
  const { rawBody, timestamp, signature, secret, toleranceSeconds } = input;
  if (!secret) return false;
  if (!rawBody || rawBody.length === 0) return false;
  if (!timestamp || !signature) return false;

  // Timestamp must be a positive integer within the freshness window.
  if (!/^\d+$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(ts)) return false;
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  const match = SIGNATURE_RE.exec(signature.trim());
  if (!match) return false;

  const signed = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]);
  const expected = createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(signed)
    .digest();
  const provided = Buffer.from(match[1], 'hex');

  return safeEqual(expected, provided);
}
