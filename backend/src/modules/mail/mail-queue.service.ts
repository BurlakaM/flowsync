import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import { MailService, type MailMessage } from './mail.service';

const QUEUE_NAME = 'mail';

/**
 * Hands emails to a queue so that a slow or broken mail server never slows a request down.
 *
 * With Redis (REDIS_URL) the messages go through BullMQ: they survive restarts and are retried with
 * a growing delay. Without Redis they are sent right here, once, and a failure is only logged.
 * Without email settings nothing is queued at all.
 */
@Injectable()
export class MailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailQueueService.name);
  private connection?: IORedis;
  private queue?: Queue<MailMessage>;
  private worker?: Worker<MailMessage>;

  constructor(
    private readonly config: AppConfigService,
    private readonly mail: MailService,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.config.redisUrl;
    if (!this.mail.enabled || !redisUrl) return;

    // BullMQ requires this option on the connection it blocks on.
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.connection.on('error', (error) =>
      this.logger.error(`Redis: ${error.message}`),
    );
    this.queue = new Queue<MailMessage>(QUEUE_NAME, {
      connection: this.connection,
    });
    this.worker = new Worker<MailMessage>(
      QUEUE_NAME,
      async (job) => {
        await this.mail.send(job.data);
      },
      { connection: this.connection },
    );
    this.worker.on('failed', (job, error) =>
      this.logger.warn(
        `Sending "${job?.data.subject}" failed (attempt ${job?.attemptsMade}): ${error.message}`,
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  /** Never throws: the caller has more important work than a notification email. */
  async enqueue(message: MailMessage): Promise<void> {
    if (!this.mail.enabled) return;

    if (this.queue) {
      try {
        await this.queue.add('send', message, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        return;
      } catch (error) {
        // Redis is down: try to send directly instead of losing the message.
        this.logger.error(
          `Could not queue "${message.subject}": ${errorMessage(error)}`,
        );
      }
    }

    try {
      await this.mail.send(message);
    } catch (error) {
      this.logger.error(
        `Could not send "${message.subject}": ${errorMessage(error)}`,
      );
    }
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
