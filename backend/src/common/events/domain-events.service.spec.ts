import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT, type DomainEvent } from './domain-event';
import { DomainEventsService } from './domain-events.service';

const event: DomainEvent = {
  type: 'task.created',
  actorId: 1,
  projectId: 2,
  entityType: 'Task',
  entityId: 3,
  data: { name: 'T' },
};

describe('DomainEventsService', () => {
  it('delivers the event to every subscriber and waits for them', async () => {
    const emitter = new EventEmitter2();
    const order: string[] = [];
    emitter.on(DOMAIN_EVENT, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('slow subscriber');
    });
    emitter.on(DOMAIN_EVENT, () => order.push('fast subscriber'));

    await new DomainEventsService(emitter).publish(event);

    expect(order).toEqual(['fast subscriber', 'slow subscriber']);
  });

  it('does not throw when a subscriber fails: the change is already saved', async () => {
    const emitter = new EventEmitter2();
    emitter.on(DOMAIN_EVENT, () => {
      throw new Error('subscriber bug');
    });

    await expect(
      new DomainEventsService(emitter).publish(event),
    ).resolves.toBeUndefined();
  });
});
