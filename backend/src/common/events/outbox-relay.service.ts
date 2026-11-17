import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../../metrics/metrics.service';
import { DomainEventsService } from './domain-events.service';

const BATCH = 20;
const KEEP_DONE_DAYS = 7;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

/**
 * The safety net of the outbox: every few seconds it delivers events that the request that created
 * them could not (the process crashed right after the commit, a subscriber failed and is waiting for
 * its next try). Several API instances may run it at once: the claim in DomainEventsService is safe.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastCleanup = 0;

  constructor(
    private readonly events: DomainEventsService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.registerMetrics();
    const interval = this.config.outboxPollIntervalMs;
    // 0 switches the loop off (tests drive `runOnce` by hand).
    if (interval <= 0) return;
    this.timer = setInterval(() => void this.runOnce(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Delivers everything that is due. Never throws and never overlaps with itself. */
  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      let total = 0;
      for (;;) {
        const handled = await this.events.deliverDue(BATCH);
        total += handled;
        if (handled < BATCH) break;
      }
      await this.cleanup();
      return total;
    } catch (error) {
      this.logger.error(
        `Outbox relay failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Delivered events are only needed for debugging; keep a week of them, not the whole history. */
  private async cleanup(): Promise<void> {
    if (Date.now() - this.lastCleanup < CLEANUP_EVERY_MS) return;
    this.lastCleanup = Date.now();
    await this.prisma.outboxEvent.deleteMany({
      where: {
        status: 'DONE',
        processedAt: { lt: new Date(Date.now() - KEEP_DONE_DAYS * 86_400_000) },
      },
    });
  }

  private registerMetrics(): void {
    this.metrics.registerGauge(
      {
        name: 'flowsync_outbox_events',
        help: 'Outbox events by status; DEAD means an event gave up and needs a human',
        labelNames: ['status'] as const,
      },
      async (gauge) => {
        const groups = await this.prisma.outboxEvent.groupBy({
          by: ['status'],
          where: { status: { in: ['PENDING', 'DEAD'] } },
          _count: true,
        });
        for (const status of ['PENDING', 'DEAD']) {
          const group = groups.find((item) => item.status === status);
          gauge.set({ status }, group?._count ?? 0);
        }
      },
    );
    this.metrics.registerGauge(
      {
        name: 'flowsync_outbox_oldest_pending_age_seconds',
        help: 'Age of the oldest undelivered event: growing means the relay is stuck',
      },
      async (gauge) => {
        const oldest = await this.prisma.outboxEvent.findFirst({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        gauge.set(
          oldest ? (Date.now() - oldest.createdAt.getTime()) / 1000 : 0,
        );
      },
    );
  }
}
