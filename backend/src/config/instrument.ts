/**
 * Observability bootstrap: OpenTelemetry tracing and Sentry error reporting.
 *
 * It must be the first import of main.ts: instrumentation works by patching modules (http, express,
 * ioredis, ...) as they load, so anything imported earlier stays invisible to traces.
 *
 * It reads process.env directly, not AppConfigService: it runs before the Nest container exists.
 * Both parts are strictly opt-in. Without OTEL_EXPORTER_OTLP_ENDPOINT and SENTRY_DSN this file does
 * nothing, so local runs and tests pay no cost.
 */
import * as Sentry from '@sentry/nestjs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { SocketIoInstrumentation } from '@opentelemetry/instrumentation-socket.io';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const NOISY_PATH = /\/(health(\/.*)?|metrics)$/;

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    // Errors only: tracing belongs to OpenTelemetry below. Sentry registers no tracer provider of its
    // own by default (enableOpenTelemetrySetup is false), so the two do not compete.
    tracesSampleRate: 0,
  });
}

// The exporter itself reads OTEL_EXPORTER_OTLP_ENDPOINT (and appends /v1/traces).
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'flowsync-api',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({
        // Probes and scrapes run every few seconds and would bury the real traces.
        ignoreIncomingRequestHook: (req) => NOISY_PATH.test(req.url ?? ''),
      }),
      new ExpressInstrumentation(),
      new IORedisInstrumentation(),
      new SocketIoInstrumentation(),
      // Adds trace_id and span_id to every pino log line: from a log line to its trace in one click.
      new PinoInstrumentation(),
      // Prisma runs queries in its own engine, so database spans need its dedicated instrumentation.
      new PrismaInstrumentation(),
    ],
  });
  sdk.start();

  // Flush buffered spans on docker stop, otherwise the last seconds of traces are lost.
  process.once('SIGTERM', () => {
    void sdk.shutdown();
  });
}
