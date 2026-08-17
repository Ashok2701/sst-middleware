import { AuditOutcome } from './audit-event.model';
import { AuditService, AuditSink } from './audit.service';

describe('AuditService', () => {
  it('records an event with generated id/timestamp and forwards to the sink', async () => {
    const recorded: any[] = [];
    const sink: AuditSink = {
      record: async (e) => {
        recorded.push(e);
      },
    };
    const service = new AuditService(sink);

    const event = await service.record({
      action: 'THING_HAPPENED',
      outcome: AuditOutcome.Success,
      targetSystem: 'SQL Server',
      entityType: 'Thing',
      entityId: '42',
    });

    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].action).toBe('THING_HAPPENED');
    expect(recorded[0].outcome).toBe(AuditOutcome.Success);
  });
});
