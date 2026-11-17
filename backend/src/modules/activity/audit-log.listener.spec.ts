import { mockDeep } from 'vitest-mock-extended';
import type { DeliveredDomainEvent } from '../../common/events/domain-event';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogListener } from './audit-log.listener';

const event: DeliveredDomainEvent = {
  id: 'b3b6c1a2-0000-4000-8000-000000000001',
  type: 'comment.created',
  actorId: 4,
  projectId: 2,
  entityType: 'Comment',
  entityId: 9,
  data: { taskId: 3, excerpt: 'hi' },
};

describe('AuditLogListener', () => {
  const prisma = mockDeep<PrismaService>();
  const listener = new AuditLogListener(prisma);

  beforeEach(() => vi.resetAllMocks());

  it('writes the event to the audit log, keyed by the event id', async () => {
    await listener.record(event);

    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: 2,
          actorId: 4,
          type: 'comment.created',
          entityType: 'Comment',
          entityId: 9,
          data: { taskId: 3, excerpt: 'hi' },
          eventId: event.id,
        },
      ],
      // Redelivery of the same event hits the unique eventId and becomes a no-op.
      skipDuplicates: true,
    });
  });

  it('does not record a deleted project: its log is deleted with it', async () => {
    await listener.record({ ...event, type: 'project.deleted' });

    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });

  it('lets a database failure out so that the outbox retries the event', async () => {
    prisma.auditLog.createMany.mockRejectedValue(new Error('db down'));

    await expect(listener.record(event)).rejects.toThrow('db down');
  });
});
