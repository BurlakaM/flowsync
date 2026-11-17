import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exposes default process metrics and the HTTP histogram', async () => {
    const metrics = new MetricsService();
    metrics.httpDuration.observe(
      { method: 'GET', route: '/api/x', status_code: '200' },
      0.05,
    );

    const text = await metrics.registry.metrics();

    expect(text).toContain('nodejs_eventloop_lag_seconds');
    expect(text).toContain('http_request_duration_seconds_count');
  });

  it('reads a registered gauge at scrape time', async () => {
    const metrics = new MetricsService();
    let open = 1;
    metrics.registerGauge({ name: 'test_open', help: 'Open things' }, (gauge) =>
      gauge.set(open),
    );

    expect(await metrics.registry.metrics()).toContain('test_open 1');
    open = 4;
    expect(await metrics.registry.metrics()).toContain('test_open 4');
  });

  it('keeps registries of separate instances apart', () => {
    expect(() => {
      new MetricsService();
      new MetricsService();
    }).not.toThrow();
  });
});
