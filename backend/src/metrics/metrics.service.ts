import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
  type GaugeConfiguration,
} from 'prom-client';

/**
 * Prometheus metrics. A private registry (not prom-client's global one) so that two application
 * instances in one process, as in the e2e tests, never register the same metric twice.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  /** Buckets chosen around the latency SLO (docs/SLO.md): fine resolution between 50 ms and 1 s. */
  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  constructor() {
    // Event loop lag, memory, GC and CPU: the cheapest early warning for a stuck Node process.
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * A gauge whose value is read at scrape time by the module that owns the data (queue depth,
   * open sockets), so the metric is never stale and nothing polls in the background.
   */
  registerGauge<T extends string>(
    config: Omit<GaugeConfiguration<T>, 'collect' | 'registers'>,
    collect: (gauge: Gauge<T>) => void | Promise<void>,
  ): void {
    new Gauge<T>({
      ...config,
      registers: [this.registry],
      async collect() {
        await collect(this);
      },
    });
  }
}
