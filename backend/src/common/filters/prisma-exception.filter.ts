import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { buildErrorBody, requestIdOf, requestPath } from './error-response';

/** Maps known Prisma errors to HTTP statuses so that services do not have to catch them. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const { status, message } = this.map(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${exception.code}: ${exception.message}`);
    }
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
  }

  private map(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${uniqueTarget(exception)} already exists`,
        };
      }
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'The operation conflicts with related records',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        };
    }
  }
}

/**
 * Which field was duplicated. With the `pg` driver adapter (Prisma 7) the error names the unique index
 * (`users_email_key`) instead of the fields, so the field is read from the index name, which Prisma builds as
 * `<table>_<fields>_key`. Older error shapes (`meta.target`) are still understood.
 */
function uniqueTarget(exception: Prisma.PrismaClientKnownRequestError): string {
  const meta = exception.meta as
    | {
        target?: unknown;
        driverAdapterError?: {
          cause?: {
            table?: string;
            constraint?: { fields?: string[]; index?: string };
          };
        };
      }
    | undefined;

  if (Array.isArray(meta?.target)) return meta.target.join(', ');
  if (typeof meta?.target === 'string') return meta.target;

  const cause = meta?.driverAdapterError?.cause;
  if (cause?.constraint?.fields?.length)
    return cause.constraint.fields.join(', ');
  const index = cause?.constraint?.index;
  if (index) {
    const withoutTable =
      cause?.table && index.startsWith(`${cause.table}_`)
        ? index.slice(cause.table.length + 1)
        : index;
    return withoutTable.replace(/_key$/, '');
  }
  return 'value';
}
