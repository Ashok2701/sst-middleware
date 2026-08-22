import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorksuiteConfig } from '../../config/configuration';
import { WorksuiteAdapter } from './worksuite.adapter';
import { createWorksuiteAuthProvider } from './worksuite.auth';
import { WorksuiteClient } from './worksuite.client';

/**
 * WorkSuite integration module. Always importable; the adapter reports DISABLED
 * and never calls WorkSuite when WORKSUITE_ENABLED is false.
 *
 * The auth-header applier is selected from configuration (none/bearer/apikey)
 * and injected into the client, keeping the (pending) authentication mechanism
 * pluggable.
 */
@Module({
  providers: [
    {
      provide: WorksuiteClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.get<WorksuiteConfig>('worksuite')!;
        const authProvider = createWorksuiteAuthProvider(cfg);
        return new WorksuiteClient(config, (headers) =>
          authProvider.applyAuthHeaders(headers),
        );
      },
    },
    WorksuiteAdapter,
  ],
  exports: [WorksuiteAdapter, WorksuiteClient],
})
export class WorksuiteModule {}
