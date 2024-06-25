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
// Is this the correct type? Its what the fastify plugin uses but might not be correct
import {
  // api,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
} from "@opentelemetry/api";
import {
  FastifyInstrumentation,
  // type FastifyRequestInfo,
} from "@opentelemetry/instrumentation-fastify";
// Library has bad import type definitions
import { default as PI } from "@prisma/instrumentation";
import { Resource } from "@opentelemetry/resources";

export interface IRequiredTelemetryConfig {
  name: string;
  version: string;
}

export function setupTelemetry(config: IRequiredTelemetryConfig) {
  // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

  // Configure the trace provider
  const provider = new NodeTracerProvider({
    // forceFlushTimeoutMillis: 1000,
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.name,
      [SEMRESATTRS_SERVICE_VERSION]: config.version,
    }),
  });

  // Configure how spans are processed and exported. In this case we're sending spans
  // as we receive them to an OTLP-compatible collector (e.g. Jaeger).
  // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  const OTLP_ENDPOINT = "http://localhost:4318/v1/traces";
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_ENDPOINT }))
  );

  // Register the provider globally
  provider.register({ propagator: new W3CTraceContextPropagator() });
  // const contextManager = new AsyncHooksContextManager();
  // contextManager.enable();
  // api.context.setGlobalContextManager(contextManager);

  // Register your auto-instrumentors
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new PI.PrismaInstrumentation(),
      new UndiciInstrumentation({
        // requestHook: (span, request) => {},
      }),
      // Fastify instrumentation expects HTTP layer to be instrumented
      new HttpInstrumentation({
        responseHook: (span, response) => {
          const spanCtx = span.spanContext();
          if (response instanceof ServerResponse) {
            response.appendHeader("trace-id", spanCtx.traceId);
            response.appendHeader("span-id", spanCtx.spanId);
          }
        },
      }),
      new FastifyInstrumentation({
        //   requestHook: function fastifyRequestHook(
        //     span: Span,
        //     info: FastifyRequestInfo
        //   ) {
        //     span.setAttribute("http.method", info.request.method);
        //   },
      }),
    ],
  });

  return provider;
}
