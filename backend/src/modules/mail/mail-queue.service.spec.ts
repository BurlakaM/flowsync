import { AppConfigService } from '../../config/app-config.service';
import type { MetricsService } from '../../metrics/metrics.service';
import { MailQueueService } from './mail-queue.service';
import type { MailService } from './mail.service';

const queueAdd = vi.fn();
const workerOn = vi.fn();
const queueClose = vi.fn();
const workerClose = vi.fn();
let processor: ((job: { data: unknown }) => Promise<void>) | undefined;

vi.mock('bullmq', () => ({
  Queue: vi.fn(function () {
    return { add: queueAdd, close: queueClose };
  }),
  Worker: vi.fn(function (
    _name: string,
    handler: (job: { data: unknown }) => Promise<void>,
  ) {
    processor = handler;
    return { on: workerOn, close: workerClose };
  }),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(function () {
    return { on: vi.fn(), disconnect: vi.fn() };
  }),
}));

const message = { to: 'ann@example.test', subject: 'Hi', text: 'Hello' };

function setup(options: { redis?: string; enabled?: boolean } = {}) {
  const send = vi.fn().mockResolvedValue({ sent: true });
  const service = new MailQueueService(
    { redisUrl: options.redis } as AppConfigService,
    { enabled: options.enabled ?? true, send } as unknown as MailService,
    { registerGauge: vi.fn() } as unknown as MetricsService,
  );
  service.onModuleInit();
  return { service, send };
}

describe('MailQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processor = undefined;
  });

  it('queues nothing while email is not configured', async () => {
    const { service, send } = setup({ enabled: false, redis: 'redis://r' });

    await service.enqueue(message);

    expect(send).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  describe('without Redis', () => {
    it('sends right away', async () => {
      const { service, send } = setup();

      await service.enqueue(message);

      expect(send).toHaveBeenCalledWith(message);
    });

    it('never throws when sending fails', async () => {
      const { service, send } = setup();
      send.mockRejectedValue(new Error('smtp down'));

      await expect(service.enqueue(message)).resolves.toBeUndefined();
    });
  });

  describe('with Redis', () => {
    it('adds the message to the queue with retries and a growing delay', async () => {
      const { service, send } = setup({ redis: 'redis://r' });

      await service.enqueue(message);

      expect(queueAdd).toHaveBeenCalledWith(
        'send',
        message,
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
        }),
      );
      expect(send).not.toHaveBeenCalled();
    });

    it('has a worker that sends what the queue hands over', async () => {
      const { send } = setup({ redis: 'redis://r' });

      await processor?.({ data: message });

      expect(send).toHaveBeenCalledWith(message);
    });

    it('sends directly when Redis is down instead of losing the message', async () => {
      const { service, send } = setup({ redis: 'redis://r' });
      queueAdd.mockRejectedValue(new Error('ECONNREFUSED'));

      await service.enqueue(message);

      expect(send).toHaveBeenCalledWith(message);
    });

    it('closes the worker and the queue on shutdown', async () => {
      const { service } = setup({ redis: 'redis://r' });

      await service.onModuleDestroy();

      expect(workerClose).toHaveBeenCalled();
      expect(queueClose).toHaveBeenCalled();
    });
  });

  it('shuts down quietly when there was nothing to start', async () => {
    const { service } = setup();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
