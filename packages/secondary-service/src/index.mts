import { setupTelemetry } from "@otel-exploration/telemetry";
import { PrismaClient } from "@otel-exploration/db";
import packageJson from "../package.json";

const PORT = 3001;

setupTelemetry(packageJson);

export async function runServer() {
  const prismaClient = new PrismaClient();
  // Deferred loading so that telemetry can monkey patch
  const Fastify = (await import("fastify")).default;
  const fastify = Fastify({
    logger: true,
  });

  // Declare a route
  fastify.get("/bar", async function rootRoute(request, reply) {
    console.log(
      "Secondary service incoming headers",
      JSON.stringify(request.headers, null, 4)
    );
    const users = await prismaClient.post.findMany();
    reply.send({ hello: "world", users });
  });

  // Run the server!
  fastify.listen({ port: PORT }, function serverListen(err, address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`Server now listening at: ${address}`);
    // Server is now listening on ${address}
  });
  return fastify;
}

await runServer();
