import { mockDeep } from 'vitest-mock-extended';
import type { DomainEvent } from '../../common/events/domain-event';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogListener } from './audit-log.listener';

const event: DomainEvent = {
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

  it('writes the event to the audit log', async () => {
    await listener.record(event);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        projectId: 2,
        actorId: 4,
        type: 'comment.created',
        entityType: 'Comment',
        entityId: 9,
        data: { taskId: 3, excerpt: 'hi' },
      },
    });
  });

  it('does not record a deleted project: its log is deleted with it', async () => {
    await listener.record({ ...event, type: 'project.deleted' });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('swallows a database failure instead of failing the request', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));

    await expect(listener.record(event)).resolves.toBeUndefined();
  });
});
