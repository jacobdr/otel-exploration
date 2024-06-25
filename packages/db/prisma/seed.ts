import { PrismaClient, type Prisma } from "@prisma/client";
import { faker } from "@faker-js/faker";
let prismaClient: PrismaClient | null;

// On top of alice and bob
const NUMBER_OF_FAKE_USERS_ADDITIONAL = 30;

async function main() {
  const prisma = new PrismaClient({
    // log: ["query"]
  });

  prismaClient = prisma;

  const alice = await prisma.user.upsert({
    where: { email: "alice@prisma.io" },
    update: {},
    create: {
      email: "alice@prisma.io",
      name: "Alice",
      posts: {
        create: {
          title: "Check out Prisma with Next.js",
          content: "https://www.prisma.io/nextjs",
          published: true,
        },
      },
    },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@prisma.io" },
    update: {},
    create: {
      email: "bob@prisma.io",
      name: "Bob",
      posts: {
        create: [
          {
            title: "Follow Prisma on Twitter",
            content: "https://twitter.com/prisma",
            published: true,
          },
          {
            title: "Follow Nexus on Twitter",
            content: "https://twitter.com/nexusgql",
            published: true,
          },
        ],
      },
    },
  });
  console.log({ alice, bob });

  let peopleCounter = 0;

  const allPeople: Prisma.UserCreateInput[] = [];

  while (peopleCounter < NUMBER_OF_FAKE_USERS_ADDITIONAL) {
    const fakePost: Prisma.PostCreateWithoutAuthorInput = {
      title: faker.word.words({ count: 3 }),
      content: faker.word.words({ count: 100 }),
    };
    const fakePerson: Prisma.UserCreateInput = {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      posts: {
        createMany: { data: [fakePost] },
      },
    };
    allPeople.push(fakePerson);
    peopleCounter++;
  }
  // Cant do a create many with many relation -- https://github.com/prisma/prisma/issues/5455
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  await Promise.all(allPeople.map((x) => prisma.user.create({ data: x! })));
}

main()
  .then(async () => {
    await prismaClient?.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prismaClient?.$disconnect();
    process.exit(1);
  })
  .finally(() => {
    console.log("Seeding completed");
  });
