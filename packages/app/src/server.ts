import { PrismaClient } from "@otel-exploration/db";
import {
  buildLogger,
  getTracingContext,
  type Resource,
} from "@otel-exploration/telemetry";
import packageJson from "../package.json";
import type { default as IFastify } from "fastify";

const PORT = 3000;

function makeRandomString(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export async function runServer({ resource }: { resource: Resource }) {
  const prismaClient = new PrismaClient({
    // log: ["query"],
  });

  const rootLogger = await buildLogger({
    loggerName: packageJson.name,
    resource,
  });

  const fastifyLogger = rootLogger.child("fastify");
  // Deferred loading so that telemetry can monkey patch
  const Fastify: typeof IFastify = require("fastify");
  const fastify = Fastify({
    logger: fastifyLogger.pinoLogger,
    genReqId: (_req) => {
      const traceCtx = getTracingContext();
      if (traceCtx.traceId) return traceCtx.traceId;
      return `unset-${makeRandomString(12)}`;
    },
  });

  // Declare a route
  fastify.get("/join-strategy", async function rootRoute(_request, reply) {
    const users = await prismaClient.user.findMany({
      relationLoadStrategy: "join",
      include: { posts: true },
    });
    reply.send({ hello: "world", users });
  });

  fastify.get("/query-strategy", async function slowRoute(_request, reply) {
    const users = await prismaClient.user.findMany({
      relationLoadStrategy: "query",
      include: { posts: true },
    });
    reply.send({ hello: "world", users });
  });

  fastify.get("/external-service", async function slowRoute(_request, reply) {
    const users = await prismaClient.user.findMany({
      relationLoadStrategy: "query",
      include: { posts: true },
    });
    const secondaryServiceData = await fetch("http://localhost:3001/bar");
    await secondaryServiceData.json();
    reply.send({ hello: "world", users });
  });

  fastify.get("/db/metrics", async function rootRoute(_request, reply) {
    const prismaMetrics = await prismaClient.$metrics.json();
    fastifyLogger.info("Prisma metrics", { prismaMetrics });
    reply.send(prismaMetrics);
  });

  fastify.get(
    "/dynamic-route/:name",
    {},
    async function dynamicRoute(request, reply) {
      const { params } = request;
      fastifyLogger.info("Route params", { params });
      reply.send(params);
    }
  );

  // Run the server!
  fastify.listen({ port: PORT }, function serverListen(err, address) {
    if (err) {
      fastifyLogger.error("Error occurred starting server", { err });
      process.exit(1);
    }
    fastifyLogger.info(`Server now listening at: ${address}`);
    // Server is now listening on ${address}
  });
  return fastify;
}
