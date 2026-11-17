import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import { DOMAIN_EVENT, type DomainEvent } from './domain-event';
import {
  DomainEventsService,
  OUTBOX_MAX_ATTEMPTS,
} from './domain-events.service';

const event: DomainEvent = {
  type: 'task.created',
  actorId: 1,
  projectId: 2,
  entityType: 'Task',
  entityId: 3,
  data: { name: 'T' },
};

describe('DomainEventsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let emitter: EventEmitter2;
  let service: DomainEventsService;
  const claimed = (attempts = 1) => [{ id: 'evt-1', payload: event, attempts }];

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    // The interactive transaction runs its callback against the same mocked client.
    prisma.$transaction.mockImplementation(((
      work: (tx: unknown) => Promise<unknown>,
    ) => work(prisma)) as never);
    prisma.outboxEvent.create.mockResolvedValue({ id: 'evt-1' } as never);
    prisma.$queryRaw.mockResolvedValue(claimed() as never);
    emitter = new EventEmitter2();
    service = new DomainEventsService(prisma, emitter);
  });

  describe('transact', () => {
    it('stores the event in the transaction of the change, then delivers it with its id', async () => {
      const received: unknown[] = [];
      emitter.on(DOMAIN_EVENT, (delivered) => received.push(delivered));

      const result = await service.transact(async (_tx, emit) => {
        emit(event);
        return 'saved';
      });

      expect(result).toBe('saved');
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: { type: 'task.created', payload: event },
        select: { id: true },
      });
      expect(received).toEqual([{ ...event, id: 'evt-1' }]);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 'evt-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'DONE', lastError: null }),
      });
    });

    it('stores and delivers nothing when the change itself fails', async () => {
      await expect(
        service.transact(async (_tx, emit) => {
          emit(event);
          throw new Error('constraint violated');
        }),
      ).rejects.toThrow('constraint violated');

      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('skips the outbox when the change publishes nothing', async () => {
      await service.transact(async () => 'quiet');

      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('does not fail the request when delivery cannot even start: the event is stored', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('db hiccup'));

      await expect(
        service.transact(async (_tx, emit) => {
          emit(event);
          return 'saved';
        }),
      ).resolves.toBe('saved');
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('failed delivery', () => {
    const failWith = (message: string) =>
      emitter.on(DOMAIN_EVENT, () => {
        throw new Error(message);
      });

    it('keeps the event pending, records the error and waits longer after each attempt', async () => {
      failWith('subscriber bug');
      prisma.$queryRaw.mockResolvedValue(claimed(3) as never);
      const before = Date.now();

      await service.deliverDue();

      const { data } = prisma.outboxEvent.updateMany.mock.calls[0][0];
      expect(data).toMatchObject({
        status: 'PENDING',
        lastError: 'subscriber bug',
      });
      // attempt 3 waits 2^3 = 8 seconds
      const waited = (data.nextAttemptAt as Date).getTime() - before;
      expect(waited).toBeGreaterThanOrEqual(7_900);
      expect(waited).toBeLessThan(9_000);
    });

    it('parks the event as DEAD after the last attempt', async () => {
      failWith('still broken');
      prisma.$queryRaw.mockResolvedValue(claimed(OUTBOX_MAX_ATTEMPTS) as never);

      await service.deliverDue();

      expect(prisma.outboxEvent.updateMany.mock.calls[0][0].data).toMatchObject(
        { status: 'DEAD', lastError: 'still broken' },
      );
    });
  });

  it('reports how many events a relay pass handled', async () => {
    prisma.$queryRaw.mockResolvedValue([
      ...claimed(),
      { id: 'evt-2', payload: event, attempts: 1 },
    ] as never);

    await expect(service.deliverDue()).resolves.toBe(2);
  });
});
