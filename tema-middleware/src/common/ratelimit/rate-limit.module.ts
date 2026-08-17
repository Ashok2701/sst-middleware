import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Request-volume protection foundation.
 *
 * Configurable via RATE_LIMIT_ENABLED / RATE_LIMIT_TTL / RATE_LIMIT_LIMIT.
 * NOTE: the default limit is a placeholder - production limits must be tuned
 * after real workload/performance testing.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('rateLimit.ttlMs') ?? 60000,
            limit: config.get<number>('rateLimit.limit') ?? 300,
          },
        ],
        skipIf: () => !config.get<boolean>('rateLimit.enabled'),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
