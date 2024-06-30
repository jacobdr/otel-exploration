import { ServerResponse } from "node:http";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
// import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  NodeTracerProvider,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-node";
// https://www.npmjs.com/package/@opentelemetry/instrumentation-http
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
// https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/instrumentation-undici/
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  OTLPMetricExporter,
  type OTLPMetricExporterOptions,
} from "@opentelemetry/exporter-metrics-otlp-http";
import type { OTLPExporterNodeConfigBase } from "@opentelemetry/otlp-exporter-base";

import {
  LoggerProvider,
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
// Is this the correct type? Its what the fastify plugin uses but might not be correct
import {
  // api,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  type Span,
} from "@opentelemetry/api";
import {
  FastifyInstrumentation,
  type FastifyRequestInfo,
} from "@opentelemetry/instrumentation-fastify";
// Library has bad import type definitions
import * as PI from "@prisma/instrumentation";
import { Resource } from "@opentelemetry/resources";
// TODO: Remove this
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { BullMQInstrumentation } from "@appsignal/opentelemetry-instrumentation-bullmq";

export interface IRequiredTelemetryConfig {
  name: string;
  version: string;
}

const OTLP_BASE_ENDPOINT = "http://localhost:4318";
const OTLP_TRACE_ENDPOINT = `${OTLP_BASE_ENDPOINT}/v1/traces`;
const OTLP_METRICS_ENDPOINT = `${OTLP_BASE_ENDPOINT}/v1/metrics`;
const OTLP_LOGS_ENDPOINT = `${OTLP_BASE_ENDPOINT}/v1/logs`;

function debugTelemetry() {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);
}

export function setupTelemetry(config: IRequiredTelemetryConfig) {
  if (
    process.env.DEBUG_TELEMETRY === "1" ||
    process.env.DEBUG_TELEMETRY?.toLowerCase() === "true"
  ) {
    debugTelemetry();
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.name,
    [SEMRESATTRS_SERVICE_VERSION]: config.version,
  });

  // Configure the trace provider
  const tracerProvider = new NodeTracerProvider({
    // forceFlushTimeoutMillis: 1000,
    resource,
  });

  // Configure how spans are processed and exported. In this case we're sending spans
  // as we receive them to an OTLP-compatible collector (e.g. Jaeger).
  // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  tracerProvider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_TRACE_ENDPOINT }))
  );

  // Register the provider globally
  tracerProvider.register({ propagator: new W3CTraceContextPropagator() });
  // const contextManager = new AsyncHooksContextManager();
  // contextManager.enable();
  // api.context.setGlobalContextManager(contextManager);

  // const metricCollectorOptions: OTLPMetricExporterOptions = {
  //   url: OTLP_METRICS_ENDPOINT,
  // };
  // const metricExporter = new OTLPMetricExporter(metricCollectorOptions);
  // const meterProvider = new MeterProvider({
  //   readers: [
  //     new PeriodicExportingMetricReader({
  //       exporter: metricExporter,
  //       exportIntervalMillis: 1_000,
  //     }),
  //   ],
  // });

  const logCollectorOptions: OTLPExporterNodeConfigBase = {
    url: OTLP_LOGS_ENDPOINT,
    timeoutMillis: 1_000,
    // headers: {}, // an optional object containing custom headers to be sent with each request
    // concurrencyLimit: 1, // an optional limit on pending requests
  };
  const logExporter = new OTLPLogExporter(logCollectorOptions);
  const loggerProvider = new LoggerProvider({ forceFlushTimeoutMillis: 1_000 });

  loggerProvider.addLogRecordProcessor(
    // new BatchLogRecordProcessor(logExporter)
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
  );

  // Register your auto-instrumentors
  registerInstrumentations({
    tracerProvider,
    // meterProvider,
    loggerProvider,
    instrumentations: [
      // Fastify instrumentation expects HTTP layer to be instrumented
      // new HttpInstrumentation({
      //   responseHook: (span, response) => {
      //     const spanCtx = span.spanContext();
      //     if (response instanceof ServerResponse) {
      //       response.appendHeader("trace-id", spanCtx.traceId);
      //       response.appendHeader("span-id", spanCtx.spanId);
      //     }
      //   },
      // }),
      new FastifyInstrumentation({
        enabled: true,
        requestHook: async function fastifyRequestHook(
          _span: Span,
          _info: FastifyRequestInfo
        ) {
          // console.info("JDR DEBUG FastifyInstrumentation.requestHook invokes", {
          //   info,
          //   span,
          // });
          // span.setAttribute("http.method", info.request.method);
        },
      }),
      new PI.PrismaInstrumentation(),
      new UndiciInstrumentation(),
      new PinoInstrumentation({
        // logHook: (_span, _record, _level) => {
        //   console.info("JDR DEBUG pino hook got invoked", { _span, _record });
        // },
      }),
      new BullMQInstrumentation(),
    ],
  });

  return { tracerProvider, meterProvider: null, loggerProvider, resource };
}
