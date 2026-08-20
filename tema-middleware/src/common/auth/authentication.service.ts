import { Inject, Injectable, Logger } from '@nestjs/common';
import { getCorrelationId } from '../correlation/correlation.context';
import { authenticationFailed, tokenExpired } from './auth.errors';
import {
  AuthenticatedUser,
  IdentityProvider,
  IDENTITY_PROVIDER,
  TokenVerificationError,
} from './auth.types';

/**
 * Orchestrates token verification and safe, operational logging.
 *
 * NEVER logs the Authorization header, the token, secrets or claim values -
 * only the correlation id, provider name, result and request path.
 */
@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger('Authentication');

  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
  ) {}

  async authenticate(token: string, path: string): Promise<AuthenticatedUser> {
    const correlationId = getCorrelationId();
    try {
      const user = await this.provider.verify(token);
      this.logger.log(
        `auth result=success provider=${this.provider.name} ` +
          `path=${path} correlationId=${correlationId}`,
      );
      return user;
    } catch (error) {
      const reason =
        error instanceof TokenVerificationError ? error.kind : 'invalid';
      this.logger.warn(
        `auth result=failed reason=${reason} provider=${this.provider.name} ` +
          `path=${path} correlationId=${correlationId}`,
      );
      if (error instanceof TokenVerificationError && error.kind === 'expired') {
        throw tokenExpired();
      }
      throw authenticationFailed();
    }
  }
}
