import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service';

const SKIPPED = /\/(health(\/.*)?|metrics)$/;

/**
 * Observes every request's duration. The `route` label is the matched pattern
 * (`/api/projects/:id`), never the raw URL: ids in labels would create a new series per project.
 */
export function httpMetricsMiddleware(metrics: MetricsService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SKIPPED.test(req.path)) return next();

    const stop = metrics.httpDuration.startTimer();
    res.on('finish', () => {
      // Nest answers unknown URLs with a catch-all route (`/api*path`). It is not a real endpoint, and an
      // unmatched URL (a scanner probing random paths) must not mint labels, so both become "unmatched".
      const pattern = req.route ? String(req.route.path) : '';
      const route =
        pattern && !pattern.includes('*')
          ? `${req.baseUrl}${pattern}`
          : 'unmatched';
      stop({
        method: req.method,
        route,
        status_code: String(res.statusCode),
      });
    });
    next();
  };
}
