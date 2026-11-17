import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  DOMAIN_EVENT,
  type DeliveredDomainEvent,
  type DomainEvent,
} from './domain-event';

/** After this many failed deliveries an event is parked as DEAD and a human has to look at it. */
export const OUTBOX_MAX_ATTEMPTS = 8;
/** How long a claimed event is invisible to other workers; a crashed worker's events return after it. */
const LEASE_SECONDS = 30;

interface ClaimedEvent {
  id: string;
  payload: DomainEvent;
  attempts: number;
}

/** `emit` records an event inside the transaction of the change that caused it. */
export type EmitEvent = (event: DomainEvent) => void;

/**
 * Transactional outbox. A service changes data and records the event in ONE transaction, so there is
 * no moment at which the change is saved but the event is lost (a crash between the two used to drop
 * audit rows, notifications and live updates). Right after the commit the event is delivered at once;
 * anything that fails or never happens (crash, subscriber error) is picked up later by the relay.
 *
 * Delivery is therefore at least once: subscribers must tolerate the same event twice (`event.id`).
 */
@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Runs `work` in a transaction. Events passed to `emit` are stored in that same transaction and
   * delivered after it commits. Delivery never throws: the change is saved, the relay retries the rest.
   */
  async transact<T>(
    work: (tx: Prisma.TransactionClient, emit: EmitEvent) => Promise<T>,
  ): Promise<T> {
    const { result, ids } = await this.prisma.$transaction(async (tx) => {
      const events: DomainEvent[] = [];
      const result = await work(tx, (event) => events.push(event));
      const rows = await Promise.all(
        events.map((event) =>
          tx.outboxEvent.create({
            data: {
              type: event.type,
              payload: event as unknown as Prisma.InputJsonObject,
            },
            select: { id: true },
          }),
        ),
      );
      return { result, ids: rows.map((row) => row.id) };
    });

    if (ids.length > 0) {
      try {
        await this.deliver(await this.claim({ ids }));
      } catch (error) {
        // The event is stored, so the relay will deliver it; the request must not fail because of that.
        this.logger.warn(
          `Immediate delivery failed, the relay will retry: ${errorText(error)}`,
        );
      }
    }
    return result;
  }

  /** One relay pass: delivers events that are due. Returns how many were handled. */
  async deliverDue(limit = 20): Promise<number> {
    const claimed = await this.claim({ limit });
    await this.deliver(claimed);
    return claimed.length;
  }

  /**
   * Takes events for delivery. The UPDATE ... FOR UPDATE SKIP LOCKED makes workers (and API instances)
   * share the table without ever taking the same row, and pushing `next_attempt_at` forward is the lease:
   * if this process dies mid-delivery the event becomes due again. Raw SQL because Prisma has no
   * `SKIP LOCKED` and the claim must be a single atomic statement.
   */
  private claim(
    options: { ids: string[] } | { limit: number },
  ): Promise<ClaimedEvent[]> {
    const filter =
      'ids' in options
        ? Prisma.sql`id = ANY(${options.ids}::uuid[])`
        : Prisma.sql`TRUE`;
    const limit = 'limit' in options ? options.limit : options.ids.length;
    return this.prisma.$queryRaw<ClaimedEvent[]>`
      UPDATE outbox_events
      SET attempts = attempts + 1,
          next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS})
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status = 'PENDING' AND next_attempt_at <= now() AND ${filter}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, payload, attempts`;
  }

  private async deliver(events: ClaimedEvent[]): Promise<void> {
    for (const { id, payload, attempts } of events) {
      try {
        const delivered: DeliveredDomainEvent = { ...payload, id };
        await this.emitter.emitAsync(DOMAIN_EVENT, delivered);
        await this.prisma.outboxEvent.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'DONE', processedAt: new Date(), lastError: null },
        });
      } catch (error) {
        await this.fail(id, attempts, error);
      }
    }
  }

  private async fail(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const dead = attempts >= OUTBOX_MAX_ATTEMPTS;
    // 2, 4, 8 ... 128 seconds: a flaky subscriber gets time to recover, and 8 tries last about four minutes.
    const delaySeconds = 2 ** attempts;
    this.logger[dead ? 'error' : 'warn'](
      `Event ${id} failed (attempt ${attempts}${dead ? ', giving up' : ''}): ${errorText(error)}`,
    );
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: dead ? 'DEAD' : 'PENDING',
        lastError: errorText(error).slice(0, 500),
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });
  }
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
