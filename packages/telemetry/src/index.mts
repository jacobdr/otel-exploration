import { ServerResponse } from "node:http";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
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
import { W3CTraceContextPropagator } from "@opentelemetry/core";
// Is this the correct type? Its what the fastify plugin uses but might not be correct
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import {
  FastifyInstrumentation,
  type FastifyRequestInfo,
} from "@opentelemetry/instrumentation-fastify";
// Library has bad import type definitions
import { default as PI } from "@prisma/instrumentation";
import { Resource } from "@opentelemetry/resources";
import packageJson from "../package.json";

export function setupTelemetry() {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

  // console.log("JDR DEBUG", foo);
  // Configure the trace provider
  const provider = new NodeTracerProvider({
    forceFlushTimeoutMillis: 1000,

    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: packageJson.name,
      [SEMRESATTRS_SERVICE_VERSION]: packageJson.version,
    }),
  });

  // Configure how spans are processed and exported. In this case we're sending spans
  // as we receive them to an OTLP-compatible collector (e.g. Jaeger).
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  const OTLP_ENDPOINT = "http://localhost:4318/v1/traces";
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_ENDPOINT }))
  );

  // Register your auto-instrumentors
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new PI.PrismaInstrumentation(),
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

  // Register the provider globally
  provider.register({ propagator: new W3CTraceContextPropagator() });
  return provider;
}
