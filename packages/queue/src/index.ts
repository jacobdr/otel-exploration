import type { Queue, Worker } from "bullmq";
import type IORedis from "ioredis";
import { buildLogger, Resource } from "@otel-exploration/telemetry";

type IQueueNameToDataPayload = {
  foo: { bar: true };
};

type IQueueNameToQueueType = {
  [QueueName in keyof IQueueNameToDataPayload]: Queue<
    IQueueNameToDataPayload[QueueName]
  >;
};

export const QUEUE_NAMES = { foo: "foo" } satisfies {
  [QueueName in keyof IQueueNameToDataPayload]: QueueName;
};

let queueConnection: IORedis | undefined;

export async function buildQueueConnection(): Promise<IORedis> {
  const { Redis: IORedisConstructor } = await import("ioredis");
  if (queueConnection) {
    return queueConnection;
  }
  queueConnection = new IORedisConstructor({ maxRetriesPerRequest: null });
  await queueConnection.hello();
  return queueConnection;
}

const jobName = "someJobName";

async function getQueues(): Promise<{
  [QueueName in keyof IQueueNameToQueueType]: IQueueNameToQueueType[QueueName];
}> {
  const {
    Queue: QueueConstructor,
  }: { Queue: typeof Queue } = require("bullmq");
  const fooQueue = new QueueConstructor<IQueueNameToDataPayload["foo"]>("foo", {
    connection: await buildQueueConnection(),
  });
  return {
    foo: fooQueue,
  } as const;
}

export async function addJob<QueueName extends keyof IQueueNameToDataPayload>(
  queueName: QueueName,
  data: IQueueNameToDataPayload[QueueName]
) {
  const logger = await buildLogger({
    loggerName: "addJob",
    resource: new Resource({}),
  });
  const queues = await getQueues();
  const queue = queues[queueName];
  const job = await queue.add(jobName, data);
  logger.info("Finished enqueueing job", { job });

  return job;
}

export async function startWorkers() {
  const {
    Worker: WorkerConstructor,
  }: { Worker: typeof Worker } = require("bullmq");
  const logger = await buildLogger({
    loggerName: "startWorkers",
    resource: new Resource({}),
  });
  logger.info("Starting workers");
  const queues = await getQueues();

  const fooWorker = new WorkerConstructor<IQueueNameToDataPayload["foo"]>(
    queues.foo.name,
    async (job) => {
      const fooLogger = logger.child("fooWorker");
      fooLogger.info("Processing incoming job", { job });
    },
    { connection: await buildQueueConnection() }
  );
}
