import { Module } from '@nestjs/common';
import { SqlServerAdapter } from './sql-server.adapter';

/**
 * SQL Server integration module. Always importable; the adapter reports
 * DISABLED and never connects when SQL_SERVER_ENABLED is false, so the app
 * starts fine without SQL configured.
 */
@Module({
  providers: [SqlServerAdapter],
  exports: [SqlServerAdapter],
})
export class SqlServerModule {}
