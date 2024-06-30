import {
  setupTelemetry,
  buildLogger,
  // type Resource,
} from "@otel-exploration/telemetry";
import { PrismaClient } from "@otel-exploration/db";
import packageJson from "../package.json";

console.log("JDR DEBUG import", import.meta.url);

const PORT = 3002;

export async function runServer() {
  const { resource } = await setupTelemetry(packageJson);
  const rootLogger = await buildLogger({
    loggerName: packageJson.name,
    resource,
  });
  const fastifyLogger = rootLogger.child("fastify");

  const prismaClient = new PrismaClient();
  // Deferred loading so that telemetry can monkey patch
  const Fastify = (await import("fastify")).default;
  const fastify = Fastify({
    logger: fastifyLogger,
  });

  // Declare a route
  fastify.get("/foo", async function rootRoute(request, reply) {
    fastifyLogger.debug("Secondary service 2 incoming headers", {
      httpHeaders: request.headers,
    });
    const users = await prismaClient.post.findMany();
    reply.send({ service: 2, users });
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
