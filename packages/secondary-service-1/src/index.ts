import {
  setupTelemetry,
  buildLogger,
  // type Resource,
} from "@otel-exploration/telemetry";
import { PrismaClient } from "@otel-exploration/db";
import {
  addJob,
  QUEUE_NAMES,
  buildQueueConnection,
  startWorkers,
} from "@otel-exploration/queue";
import type { default as IFastify } from "fastify";
import packageJson from "../package.json";

const PORT = 3001;

export async function runServer() {
  const { resource } = await setupTelemetry(packageJson);
  const rootLogger = await buildLogger({
    loggerName: packageJson.name,
    resource,
  });

  await buildQueueConnection();
  const fastifyLogger = rootLogger.child("fastify");

  const prismaClient = new PrismaClient();
  // Deferred loading so that telemetry can monkey patch
  const Fastify: typeof IFastify = require("fastify");
  const fastify = Fastify({
    logger: fastifyLogger,
  });

  await startWorkers();

  // Declare a route
  fastify.get("/bar", async function rootRoute(request, reply) {
    fastifyLogger.debug("Secondary service 1 incoming headers", {
      httpHeaders: request.headers,
    });
    const users = await prismaClient.post.findMany();
    return reply.send({ service: 1, users });
  });

  // Declare a route
  fastify.get("/far", async function farRoute(_request, reply) {
    const job = await addJob(QUEUE_NAMES.foo, { bar: true });
    return reply.send({ job });
  });

  // Run the server!
  fastify.listen({ port: PORT }, function serverListen(err, address) {
    if (err) {
      fastifyLogger.error("Error occurred during server startup", { err });
      process.exit(1);
    }
    fastifyLogger.info(`Server now listening at: ${address}`);
  });
  return fastify;
}

runServer();
