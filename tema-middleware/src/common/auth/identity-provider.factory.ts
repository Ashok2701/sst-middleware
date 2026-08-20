import { AuthConfig } from '../../config/configuration';
import { IdentityProvider } from './auth.types';
import { DevJwtProvider } from './dev-jwt.provider';
import { OidcJwksProvider } from './oidc-jwks.provider';

/** Never invoked while auth is disabled; guards against accidental use. */
class DisabledIdentityProvider implements IdentityProvider {
  readonly name = 'disabled';
  async verify(): Promise<never> {
    throw new Error('Authentication is disabled');
  }
}

/**
 * Selects the identity provider from configuration. Only the SELECTED provider
 * is constructed, so a disabled/oidc production deployment never instantiates
 * (or accidentally enables) the dev provider.
 */
export function createIdentityProvider(
  cfg: AuthConfig,
  nodeEnv: string,
): IdentityProvider {
  if (!cfg.enabled) {
    return new DisabledIdentityProvider();
  }
  if (cfg.provider === 'oidc') {
    return new OidcJwksProvider(cfg);
  }
  // provider === 'dev'
  if (nodeEnv === 'production') {
    throw new Error(
      'AUTH_PROVIDER=dev cannot be enabled in production; use AUTH_PROVIDER=oidc',
    );
  }
  return new DevJwtProvider(cfg, nodeEnv);
}
