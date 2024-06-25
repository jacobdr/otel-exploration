import { PrismaClient } from "@otel-exploration/db";

const PORT = 3000;

export async function runServer() {
  const prismaClient = new PrismaClient({
    log: ["query"],
  });
  // Deferred loading so that telemetry can monkey patch
  const Fastify = (await import("fastify")).default;
  const fastify = Fastify({
    logger: true,
  });

  // Declare a route
  fastify.get("/", async function rootRoute(_request, reply) {
    const users = await prismaClient.user.findMany({
      include: { posts: true },
    });
    const secondaryServiceData = await fetch("http://localhost:3001/bar");
    await secondaryServiceData.json();
    reply.send({ hello: "world", users });
  });

  fastify.get("/slow", async function slowRoute(_request, reply) {
    const users = await prismaClient.user.findMany({
      relationLoadStrategy: "query",
      include: { posts: true },
    });
    const secondaryServiceData = await fetch("http://localhost:3001/bar");
    await secondaryServiceData.json();
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
