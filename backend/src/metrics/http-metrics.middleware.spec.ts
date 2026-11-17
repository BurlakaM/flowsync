import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { httpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsService } from './metrics.service';

function run(metrics: MetricsService, req: Partial<Request>, statusCode = 200) {
  const res = Object.assign(new EventEmitter(), { statusCode });
  const next = vi.fn();
  httpMetricsMiddleware(metrics)(
    req as Request,
    res as unknown as Response,
    next,
  );
  res.emit('finish');
  return next;
}

describe('httpMetricsMiddleware', () => {
  it('labels a request with the route pattern, not the URL', async () => {
    const metrics = new MetricsService();

    run(metrics, {
      method: 'GET',
      path: '/api/projects/42',
      baseUrl: '',
      route: { path: '/api/projects/:id' },
    });

    const text = await metrics.registry.metrics();
    expect(text).toContain('route="/api/projects/:id"');
    expect(text).not.toContain('/projects/42');
  });

  it('collapses unmatched URLs into one label', async () => {
    const metrics = new MetricsService();

    run(metrics, { method: 'GET', path: '/wp-admin/x', baseUrl: '' }, 404);

    expect(await metrics.registry.metrics()).toContain('route="unmatched"');
  });

  it('treats the framework catch-all route as unmatched', async () => {
    const metrics = new MetricsService();

    run(
      metrics,
      {
        method: 'GET',
        path: '/api/x',
        baseUrl: '',
        route: { path: '/api*path' },
      },
      404,
    );

    const text = await metrics.registry.metrics();
    expect(text).toContain('route="unmatched"');
    expect(text).not.toContain('*path');
  });

  it('ignores health checks and the scrape itself', async () => {
    const metrics = new MetricsService();

    const next = run(metrics, { method: 'GET', path: '/api/health/ready' });
    run(metrics, { method: 'GET', path: '/api/metrics' });

    expect(next).toHaveBeenCalled();
    expect(await metrics.registry.metrics()).not.toContain(
      'http_request_duration_seconds_count',
    );
  });
});
