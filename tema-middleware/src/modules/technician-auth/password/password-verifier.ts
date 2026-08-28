import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/**
 * Pluggable password verification for technician login.
 *
 * The abstraction lets the implementation be REPLACED later (with the confirmed
 * WorkSuite PBKDF2-SHA256 verifier) WITHOUT changing the login API, controller,
 * technician model, role model, SQL integration or auth architecture.
 */
export interface PasswordVerifier {
  verify(plaintext: string, stored: string | undefined): Promise<boolean>;
}

export const TECHNICIAN_PASSWORD_VERIFIER = Symbol(
  'TECHNICIAN_PASSWORD_VERIFIER',
);

/**
 * TEMPORARY DEVELOPMENT verifier.
 *
 * WorkSuite has NOT yet provided the final PBKDF2-SHA256 parameters/format, so
 * for the current development environment the stored XPASSWRD_0 value is treated
 * as a plaintext development password and compared in constant time.
 *
 * This is TEMPORARY and MUST be replaced by a PBKDF2-SHA256 verifier once the
 * exact WorkSuite parameters are confirmed. The system does not permanently
 * depend on plaintext: only this class changes. Passwords are never logged.
 */
@Injectable()
export class PlaintextPasswordVerifier implements PasswordVerifier {
  async verify(
    plaintext: string,
    stored: string | undefined,
  ): Promise<boolean> {
    if (stored === undefined || stored === null) return false;
    const a = Buffer.from(String(plaintext), 'utf8');
    const b = Buffer.from(String(stored), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
