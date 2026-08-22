import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { WorksuiteConfig } from '../../../config/configuration';
import { StoredCredential } from '../models/contractor.model';

const pbkdf2Async = promisify(pbkdf2);

/** Node digest name for the configured PBKDF2-SHA256 algorithm. */
const SUPPORTED_ALGORITHM = 'PBKDF2-SHA256';
const NODE_DIGEST = 'sha256';

export interface Pbkdf2Params {
  iterations: number;
  saltLength: number;
  keyLength: number;
  encoding: BufferEncoding;
}

/**
 * Contractor local password verification.
 *
 * CONFIRMED: WorkSuite proposed PBKDF2-SHA256 and is the source of truth for
 * contractor credentials; TEMA stores the received hash and verifies locally.
 *
 * PENDING (NOT yet WorkSuite-compatible): the exact iteration count, salt
 * length, derived key length, encoding and stored-hash format are NOT confirmed
 * by WorkSuite. They are fully configuration-driven here and MUST be validated
 * byte-for-byte against real WorkSuite test vectors before this can be claimed
 * interoperable. Until then `isConfigured()` reports false when params are unset.
 *
 * This does NOT introduce a new identity provider and does NOT modify the
 * Phase 3.1/3.2 authentication architecture. Plaintext is never stored/logged.
 */
@Injectable()
export class WorksuitePasswordVerifier {
  private readonly logger = new Logger(WorksuitePasswordVerifier.name);
  private readonly cfg: WorksuiteConfig['password'];

  constructor(config: ConfigService) {
    this.cfg = config.get<WorksuiteConfig>('worksuite')!.password;
  }

  /** Whether the algorithm is supported AND all PBKDF2 params are configured. */
  isConfigured(): boolean {
    return (
      this.cfg.algorithm?.toUpperCase() === SUPPORTED_ALGORITHM &&
      this.cfg.iterations !== undefined &&
      this.cfg.saltLength !== undefined &&
      this.cfg.keyLength !== undefined &&
      this.cfg.encoding !== undefined
    );
  }

  /** Effective params, preferring values stored WITH the credential. */
  private resolveParams(credential?: StoredCredential): Pbkdf2Params {
    const iterations = credential?.iterations ?? this.cfg.iterations;
    const keyLength = credential?.keyLength ?? this.cfg.keyLength;
    const saltLength = this.cfg.saltLength;
    const encoding = (credential?.encoding ?? this.cfg.encoding) as
      BufferEncoding | undefined;

    if (
      iterations === undefined ||
      keyLength === undefined ||
      saltLength === undefined ||
      encoding === undefined
    ) {
      throw new Error(
        'WorkSuite PBKDF2 parameters are not configured (pending WorkSuite spec)',
      );
    }
    return { iterations, keyLength, saltLength, encoding };
  }

  /**
   * Verifies a plaintext password against a stored WorkSuite credential.
   * Returns false for unsupported algorithms or malformed credentials; never
   * throws for a bad password.
   */
  async verify(
    plaintext: string,
    credential: StoredCredential,
  ): Promise<boolean> {
    if (
      !credential ||
      credential.algorithm?.toUpperCase() !== SUPPORTED_ALGORITHM
    ) {
      return false;
    }
    if (!credential.salt || !credential.hash) return false;

    const params = this.resolveParams(credential);
    const salt = Buffer.from(credential.salt, params.encoding);
    const expected = Buffer.from(credential.hash, params.encoding);
    if (!salt.length || !expected.length) return false;

    const derived = await pbkdf2Async(
      plaintext.normalize('NFC'),
      salt,
      params.iterations,
      expected.length,
      NODE_DIGEST,
    );
    const actual = Buffer.from(derived);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  /**
   * Derives a stored credential using the CONFIGURED params. Intended for local
   * testing / fixtures only - it is NOT proven WorkSuite-compatible until real
   * parameters/test vectors are supplied. Never receives or returns plaintext.
   */
  async hash(plaintext: string): Promise<StoredCredential> {
    const params = this.resolveParams();
    const salt = randomBytes(params.saltLength);
    const derived = await pbkdf2Async(
      plaintext.normalize('NFC'),
      salt,
      params.iterations,
      params.keyLength,
      NODE_DIGEST,
    );
    return {
      algorithm: SUPPORTED_ALGORITHM,
      hash: Buffer.from(derived).toString(params.encoding),
      salt: salt.toString(params.encoding),
      iterations: params.iterations,
      keyLength: params.keyLength,
      encoding: params.encoding,
    };
  }
}
