import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SageX3Config } from '../../config/configuration';
import { SageX3Adapter } from './sage-x3.adapter';
import { createSageAuthProvider } from './sage-x3.auth';
import { SageX3Client } from './sage-x3.client';

/**
 * Sage X3 integration module. Always importable; the adapter reports DISABLED
 * and never calls Sage when SAGE_X3_ENABLED is false.
 *
 * The auth-header applier is selected from configuration (none/basic/apikey)
 * and injected into the client, keeping the authentication mechanism pluggable.
 */
@Module({
  providers: [
    {
      provide: SageX3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.get<SageX3Config>('sageX3')!;
        const authProvider = createSageAuthProvider(cfg);
        return new SageX3Client(config, (headers) =>
          authProvider.applyAuthHeaders(headers),
        );
      },
    },
    SageX3Adapter,
  ],
  exports: [SageX3Adapter, SageX3Client],
})
export class SageX3Module {}
