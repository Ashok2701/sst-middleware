import { Module } from '@nestjs/common';
import { LeadPerfectionAdapter } from './lead-perfection.adapter';
import { LeadPerfectionClient } from './lead-perfection.client';

/**
 * Lead Perfection integration module (Phase 3.6 foundation). Always importable;
 * the adapter reports DISABLED and never calls Lead Perfection when
 * LEAD_PERFECTION_ENABLED is false.
 */
@Module({
  providers: [LeadPerfectionClient, LeadPerfectionAdapter],
  exports: [LeadPerfectionAdapter, LeadPerfectionClient],
})
export class LeadPerfectionModule {}
