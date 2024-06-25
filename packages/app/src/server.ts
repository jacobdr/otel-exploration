import { PrismaClient } from "@prisma/client";

export async function runServer() {
  const prismaClient = new PrismaClient();
  // Deferred loading so that telemetry can monkey patch
  const Fastify = (await import("fastify")).default;
  const fastify = Fastify({
    logger: true,
  });

  // Declare a route
  fastify.get("/", async function rootRoute(_request, reply) {
    const users = await prismaClient.user.findMany();
    reply.send({ hello: "world", users });
  });

  const PORT = 3000;

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
