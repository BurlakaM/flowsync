import * as Sentry from '@sentry/react';
import { initMonitoring, reportError } from './monitoring';

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }));

describe('monitoring', () => {
  it('stays off and reports nothing without a DSN', () => {
    initMonitoring(undefined, 'test');
    reportError(new Error('x'));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('starts once with a DSN and then reports errors', () => {
    const dsn = 'https://key@o1.ingest.sentry.io/1';
    const error = new Error('boom');

    initMonitoring(dsn, 'production');
    initMonitoring(dsn, 'production');
    reportError(error);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn, environment: 'production' }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
