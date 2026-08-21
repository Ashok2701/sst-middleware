import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  IntegrationError,
  IntegrationErrorCode,
} from '../../common/integration/errors/integration-error';
import { InMemoryTransactionStore } from '../../common/integration/transaction/transaction-store';
import { TransactionTrackerService } from '../../common/integration/transaction/transaction-tracker.service';
import { SqlServerAdapter } from '../../integrations/sql-server/sql-server.adapter';
import { TechnicianMapper } from './mappers/technician.mapper';
import { TechniciansService } from './technicians.service';

function build(procedure: string | undefined, execute: jest.Mock) {
  const sql = {
    executeStoredProcedure: execute,
  } as unknown as SqlServerAdapter;
  const config = {
    get: (k: string) => (k === 'technicians.procedure' ? procedure : undefined),
  } as unknown as ConfigService;
  const tracker = new TransactionTrackerService(new InMemoryTransactionStore());
  return new TechniciansService(sql, config, tracker, new TechnicianMapper());
}

describe('TechniciansService', () => {
  it('throws INTEGRATION_NOT_CONFIGURED when no source procedure is set', async () => {
    const service = build(undefined, jest.fn());
    await expect(service.getTechnicians()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns mapped technicians from the SQL source', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue([{ technicianId: 'T1', name: 'A', status: 'ACTIVE' }]);
    const service = build('usp_get_technicians', execute);
    const result = await service.getTechnicians();
    expect(execute).toHaveBeenCalledWith('usp_get_technicians');
    expect(result).toEqual([
      expect.objectContaining({
        technicianId: 'T1',
        name: 'A',
        status: 'ACTIVE',
      }),
    ]);
  });

  it('returns an empty array when the source has no rows', async () => {
    const service = build('usp', jest.fn().mockResolvedValue([]));
    expect(await service.getTechnicians()).toEqual([]);
  });

  it('propagates a normalised IntegrationError from the adapter (no swallow)', async () => {
    const execute = jest
      .fn()
      .mockRejectedValue(
        new IntegrationError(IntegrationErrorCode.TIMEOUT_ERROR),
      );
    const service = build('usp', execute);
    await expect(service.getTechnicians()).rejects.toMatchObject({
      code: IntegrationErrorCode.TIMEOUT_ERROR,
    });
  });
});
