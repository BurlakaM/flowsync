import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { buildErrorBody, requestIdOf, requestPath } from './error-response';

/** Catch-all: HTTP exceptions keep their status, anything else becomes a logged 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      response
        .status(status)
        .json(
          buildErrorBody(
            status,
            message,
            requestPath(request),
            requestIdOf(request),
          ),
        );
      return;
    }

    // A no-op while Sentry is not initialised (no SENTRY_DSN). 4xx are the client's mistakes and are not sent.
    Sentry.captureException(exception);
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response
      .status(500)
      .json(
        buildErrorBody(
          500,
          'Internal server error',
          requestPath(request),
          requestIdOf(request),
        ),
      );
  }
}
