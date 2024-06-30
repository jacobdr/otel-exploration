import type { Logger, LevelWithSilent, LoggerOptions } from "pino";
import {
  context,
  diag,
  trace,
  isSpanContextValid,
  Span,
} from "@opentelemetry/api";

import type { Resource } from "@opentelemetry/resources";

import type { FastifyReply } from "fastify";
import type { Options as IPinoOTLPTransportOptions } from "pino-opentelemetry-transport";

export type { Logger as PinoLogger };

type IContextWithOptionalError = { err?: Error } & Record<string, unknown>;

export interface ILogger {
  readonly level: LevelWithSilent;
  child(name: string): BasicLogger;
  trace(message: string, context?: IContextWithOptionalError): void;
  debug(message: string, context?: IContextWithOptionalError): void;
  info(message: string, context?: IContextWithOptionalError): void;
  warn(message: string, context?: IContextWithOptionalError): void;
  error(
    message: string,
    context: { err: Error } & IContextWithOptionalError
  ): void;
  fatal(
    message: string,
    context: { err: Error } & IContextWithOptionalError
  ): void;
}

function parseLogLevel(): LevelWithSilent {
  const logLevelEnv = process.env.LOG_LEVEL?.toLowerCase() || "info";
  switch (logLevelEnv) {
    case "silent":
      return "silent";
    case "trace":
      return "trace";
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "warning":
      return "warn";
    case "error":
      return "error";
    default:
      return "info";
  }
}

class BasicLogger implements ILogger {
  constructor(public readonly pinoLogger: Logger) {}

  get level() {
    return this.pinoLogger.level as LevelWithSilent;
  }

  child(name: string): BasicLogger {
    const pinoChild = this.pinoLogger.child({ name });
    return new BasicLogger(pinoChild);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.trace(context, message);
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.debug(context, message);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.info(context, message);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.warn(context, message);
  }
  error(
    message: string,
    context: { err: Error } & Record<string, unknown>
  ): void {
    this.pinoLogger.error(context, message);
  }

  fatal(
    message: string,
    context: { err: Error } & Record<string, unknown>
  ): void {
    this.error(message, context);
  }
}

export function getTracingContext():
  | { traceId: null; spanId: null }
  | { traceId: string; spanId: string } {
  // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-pino/src/instrumentation.ts
  const span = trace.getSpan(context.active());
  const emptyContextLogContext = {
    traceId: null,
    spanId: null,
  };
  if (!span) {
    return emptyContextLogContext;
  }

  const spanContext = span.spanContext();

  if (!isSpanContextValid(spanContext)) {
    return emptyContextLogContext;
  }

  const record = {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };

  return record;
}

export async function buildLogger({
  loggerName,
  resource,
}: {
  loggerName: string;
  resource: Resource;
}): Promise<BasicLogger> {
  const { pino, levels } = await import("pino");

  const options: LoggerOptions = {
    name: `${loggerName}:rootLogger`,
    level: parseLogLevel(),
    serializers: { err: pino.stdSerializers.err },
    // timestamp: pino.stdTimeFunctions.isoTime,
    // nestedKey: "context",
    formatters: {
      // Changes the level to the text value like info
      // level: (label) => {
      //   return {
      //     level: label,
      //   };
      // },
    },
    mixin(_obj, num, _logger) {
      const levelAsText = levels.labels[num];
      return {
        levelLabel: levelAsText,
        tracing: getTracingContext(),
      };
    },
    hooks: {
      // https://getpino.io/#/docs/api?id=logmethod
      //   logMethod(inputArgs, method, _level) {
      //     if (inputArgs.length >= 2) {
      //       const arg1 = inputArgs.shift();
      //       const arg2 = inputArgs.shift();
      //       return method.apply(this, [arg2, arg1, ...inputArgs]);
      //     }
      //   },
    },
    transport: {
      targets: [
        {
          // This writes to stdout
          target: "pino/file",
          options: { destination: 1 },
        },
        {
          // https://www.npmjs.com/package/pino-opentelemetry-transport/v/0.2.0
          target: "pino-opentelemetry-transport",
          options: {
            resourceAttributes: resource.attributes,
            logRecordProcessorOptions: {
              exporterOptions: { protocol: "grpc" },
            },
          } as IPinoOTLPTransportOptions,
        },
      ],
    },
  };

  const rootLogger = pino(options);
  return new BasicLogger(rootLogger);
}
