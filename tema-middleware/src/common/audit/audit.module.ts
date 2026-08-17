import { Global, Module } from '@nestjs/common';
import { AUDIT_SINK, AuditService, LoggingAuditSink } from './audit.service';

/**
 * Global business-audit foundation. Default sink logs to a dedicated 'Audit'
 * stream, kept separate from technical troubleshooting logs.
 */
@Global()
@Module({
  providers: [
    { provide: AUDIT_SINK, useClass: LoggingAuditSink },
    AuditService,
  ],
  exports: [AuditService],
})
export class AuditModule {}
