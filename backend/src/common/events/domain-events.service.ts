import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT, type DomainEvent } from './domain-event';

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Publishes an event and waits for the subscribers, so that the audit log is complete when the
   * request ends. Subscribers must therefore be quick (queue the slow work). A failing subscriber
   * must never break the request that has already saved its change: errors are logged and swallowed.
   */
  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.emitter.emitAsync(DOMAIN_EVENT, event);
    } catch (error) {
      this.logger.error(
        `A subscriber of ${event.type} failed: ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );
    }
  }
}
